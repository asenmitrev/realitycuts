/**
 * Unified library item media processor — single source of truth for
 * thumbnail generation, preview generation, and perceptual hash generation.
 *
 * Replaces three separate Lambda functions:
 *   - library-item-thumbnail-generator
 *   - library-item-preview-generator
 *   - library-item-hash-generation
 *
 * Used by:
 * - BullMQ workers on EC2 (via app/server/services/bullmq/workers.ts)
 *
 * The processor dispatches on `taskType` in the job payload to determine
 * which media operation to perform.
 */

import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import type { LibraryItemMediaGenerationEventData } from "shared/types/event-contracts";
import brollRepository from "server/repositories/broll.repository";
import { getS3FileUrl } from "server/config/storage";
import { downloadFile, safelyDeleteDir } from "server/services/fs";
import { uploadToS3 } from "server/services/storage/s3";
import { logger } from "server/services/logging";
import { ThumbnailDuplicateDetector } from "server/services/video-generation/v11-proper-context/utils/thumbnail-duplicate-detector";

// ---------------------------------------------------------------------------
// FFmpeg helpers — runs ffmpeg from system PATH (EC2 deployment).
// ---------------------------------------------------------------------------

/**
 * Generate a thumbnail frame from a video at the 66% mark.
 * Outputs a 640px-wide PNG.
 */
async function generateThumbnail(
	videoPath: string,
	outputPath: string,
): Promise<string> {
	return new Promise((resolve, reject) => {
		ffmpeg(videoPath)
			.on("end", () => {
				logger.info("Thumbnail frame extraction complete");
				resolve(outputPath);
			})
			.on("error", (err) => {
				logger.error("Error generating thumbnail:", err);
				reject(err);
			})
			.screenshots({
				timestamps: ["66%"],
				filename: path.basename(outputPath),
				folder: path.dirname(outputPath),
				size: "640x?",
			});
	});
}

/**
 * Generate a lower-quality preview video (640px max width, 24fps, 500k bitrate).
 */
async function generatePreview(
	videoPath: string,
	outputPath: string,
): Promise<string> {
	return new Promise((resolve, reject) => {
		ffmpeg(videoPath)
			.on("end", () => {
				logger.info("Preview video generation complete");
				resolve(outputPath);
			})
			.on("error", (err) => {
				logger.error("Error generating preview video:", err);
				reject(err);
			})
			.videoCodec("libx264")
			.audioCodec("aac")
			.size("640x?")
			.videoBitrate("500k")
			.audioBitrate("64k")
			.fps(24)
			.outputOptions([
				"-preset veryfast",
				"-crf 23",
				"-movflags +faststart",
			])
			.output(outputPath)
			.run();
	});
}

// ---------------------------------------------------------------------------
// Task handlers
// ---------------------------------------------------------------------------

/**
 * Thumbnail generation task — extracts a frame at 66% of the video,
 * uploads to S3, saves thumbnailUrl2 on the broll, and enqueues
 * downstream classification.
 */
async function handleThumbnailTask({
	brollId,
	userId,
	prompt,
	videoDescription,
}: LibraryItemMediaGenerationEventData): Promise<void> {
	const tmpDir = `/tmp/${brollId}`;
	try {
		fs.mkdirSync(tmpDir, { recursive: true });

		const broll = await brollRepository.findById(brollId);
		if (!broll) {
			logger.error(`BrollFootageMetadata not found for brollId: ${brollId}`);
			return;
		}
		if (broll.thumbnailUrl2) {
			logger.info("Thumbnail already exists, skipping", { brollId });
			return;
		}
		if (!broll.libraryId) {
			logger.error("LibraryId not found for broll", { brollId });
			return;
		}

		const downloadPath = `${tmpDir}/download${path.extname(broll.url)}`;
		const thumbnailPath = `${tmpDir}/thumbnail.png`;

		logger.info("Downloading video for thumbnail generation", { brollId });
		await downloadFile(downloadPath, broll.url);

		if (!fs.existsSync(downloadPath)) {
			throw new Error(`Video download failed — file not found at ${downloadPath}`);
		}

		logger.info("Generating thumbnail frame", { brollId });
		await generateThumbnail(downloadPath, thumbnailPath);

		const uniqueId = nanoid();
		const thumbnailName = `/users/${userId}/library/${broll.libraryId}/${Date.now()}-${uniqueId}-thumbnail2.png`;

		logger.info("Uploading thumbnail to S3", { brollId, thumbnailName });
		await uploadToS3(thumbnailPath, thumbnailName, {
			mimeType: "image/png",
			originalName: thumbnailName,
			fileSize: fs.statSync(thumbnailPath).size,
			userId,
		});

		const thumbnailUrl = getS3FileUrl(thumbnailName);
		await brollRepository.update(brollId, { thumbnailUrl2: thumbnailUrl });

		logger.info("Thumbnail generation completed", { brollId, thumbnailUrl });

		// Enqueue downstream classification task
		if (prompt || videoDescription) {
			const { enqueueLibraryItemClassificationTask } = await import(
				"../task-queue.js"
			);
			await enqueueLibraryItemClassificationTask({
				brollId,
				userId,
				prompt: prompt ?? "",
				ytVideoDescription: videoDescription ?? "",
				version: "2.0.0" as const,
			});
		}
	} finally {
		safelyDeleteDir(tmpDir);
	}
}

/**
 * Preview generation task — creates a low-quality preview video,
 * uploads to S3, and saves the preview URL on the broll.
 */
async function handlePreviewTask({
	brollId,
	userId,
}: LibraryItemMediaGenerationEventData): Promise<void> {
	const tmpDir = `/tmp/${brollId}`;
	try {
		fs.mkdirSync(tmpDir, { recursive: true });

		const broll = await brollRepository.findById(brollId);
		if (!broll) {
			logger.error(`BrollFootageMetadata not found for brollId: ${brollId}`);
			return;
		}
		if (broll.isDeleted) {
			logger.info("Broll is deleted, skipping preview generation", { brollId });
			return;
		}
		if (!broll.libraryId) {
			logger.error("LibraryId not found for broll", { brollId });
			return;
		}

		const downloadPath = `${tmpDir}/download${path.extname(broll.url)}`;
		const previewPath = `${tmpDir}/preview.mp4`;

		logger.info("Downloading video for preview generation", { brollId });
		await downloadFile(downloadPath, broll.url);

		if (!fs.existsSync(downloadPath)) {
			throw new Error(`Video download failed — file not found at ${downloadPath}`);
		}

		logger.info("Generating preview video", { brollId });
		await generatePreview(downloadPath, previewPath);

		const uniqueId = nanoid();
		const previewName = `/users/${userId}/library/${broll.libraryId}/${Date.now()}-${uniqueId}-preview.mp4`;

		logger.info("Uploading preview video to S3", { brollId, previewName });
		await uploadToS3(previewPath, previewName, {
			mimeType: "video/mp4",
			originalName: previewName,
			fileSize: fs.statSync(previewPath).size,
			userId,
		});

		const previewUrl = getS3FileUrl(previewName);
		await brollRepository.update(brollId, { preview: previewUrl });

		logger.info("Preview generation completed", { brollId, previewUrl });
	} finally {
		safelyDeleteDir(tmpDir);
	}
}

/**
 * Hash generation task — computes a perceptual hash from the broll's
 * thumbnail and saves it on the broll document.
 */
async function handleHashTask({
	brollId,
}: LibraryItemMediaGenerationEventData): Promise<void> {
	const broll = await brollRepository.findById(brollId);
	if (!broll) {
		throw new Error(`Broll not found for brollId: ${brollId}`);
	}
	if (!broll.thumbnailUrl) {
		throw new Error(
			`Broll ${brollId} has no thumbnailUrl — cannot generate hash`,
		);
	}

	logger.info("Generating perceptual hash", { brollId });
	const hash = await ThumbnailDuplicateDetector.getPerceptualHash(
		broll.thumbnailUrl,
	);

	await brollRepository.update(brollId, { perceptualHash: hash });

	logger.info("Hash generation completed", { brollId, hash });
}

// ---------------------------------------------------------------------------
// Public entry point — dispatched by the BullMQ worker.
// ---------------------------------------------------------------------------

/**
 * Process a unified media generation task.
 *
 * Dispatches to the appropriate handler based on `taskType`.
 *
 * @param eventData — job payload from the 'library-item-media-generation' queue
 */
export async function processLibraryItemMediaTask(
	eventData: LibraryItemMediaGenerationEventData,
): Promise<void> {
	const { brollId, taskType } = eventData;

	logger.info("Starting media processing task", {
		brollId,
		taskType,
	});

	switch (taskType) {
		case "thumbnail":
			await handleThumbnailTask(eventData);
			break;
		case "preview":
			await handlePreviewTask(eventData);
			break;
		case "hash":
			await handleHashTask(eventData);
			break;
		default:
			throw new Error(`Unknown taskType: ${(taskType as string)}`);
	}
}
