/**
 * Library item processing processor — unified video embedding + classification.
 *
 * Merges the logic from two separate Lambda functions:
 * - functions/library-item-video-embedding (Vertex AI embeddings + description)
 * - functions/library-item-classification (Claude metadata + MongoDB upsert)
 *
 * Used by:
 * - BullMQ workers on EC2 (via app/server/services/bullmq/workers.ts)
 *
 * Follows the pattern established by library-item-deletion-processor.ts.
 */

import { BrollFootageMetadata } from "server/models/broll-video-metadata";
import { Library } from "server/models/library";
import { Notification } from "server/models/notification";
import { TranscriptionJob } from "server/models/transcription-job";
import videoAiDataRepository from "server/repositories/video-ai-data.repository";
import {
	enqueueLambdaVideoGenerationTask,
	enqueueLibraryItemDeletionTask,
	enqueueLibraryItemMediaGenerationTask,
} from "server/services/task-queue";
import { logger } from "server/services/logging";
import type {
	LibraryItemProcessingEventData,
	VideoGenerationEventDataV3,
} from "shared/types/event-contracts";
import { calculateTotalProgress } from "shared/utils/misc";

// ---------------------------------------------------------------------------
// Lazy-loaded heavy dependencies
// ---------------------------------------------------------------------------

let createVideoEmbeddingsFn:
	| ((
			videoPath: string,
			start: number,
			end: number,
			interval: number,
			text?: string,
	  ) => Promise<any>)
	| null = null;

async function getVideoEmbeddingFn() {
	if (!createVideoEmbeddingsFn) {
		const { createVideoEmbeddings } = await import("../ai/vertex.js");
		createVideoEmbeddingsFn = createVideoEmbeddings;
	}
	return createVideoEmbeddingsFn;
}

let describeVideoBasedOnFrameFn:
	| ((params: {
			imageUrl1: string;
			imageUrl2: string;
			prompt: string;
			videoDescription: string;
	  }) => Promise<string>)
	| null = null;

async function getDescriptionGeneratorFn() {
	if (!describeVideoBasedOnFrameFn) {
		const { describeVideoBasedOnFrame } = await import(
			"../ai/description-generator.js"
		);
		describeVideoBasedOnFrameFn = describeVideoBasedOnFrame;
	}
	return describeVideoBasedOnFrameFn;
}

let generateMetadataForVideoFn: ((urls: string[]) => Promise<any>) | null =
	null;

async function getMetadataGeneratorFn() {
	if (!generateMetadataForVideoFn) {
		const { generateMetadataForVideo } = await import(
			"../../agents/metadata-generation.qwen.agent.js"
		);
		generateMetadataForVideoFn = generateMetadataForVideo;
	}
	return generateMetadataForVideoFn;
}

// ---------------------------------------------------------------------------
// Main processor
// ---------------------------------------------------------------------------

/**
 * Process a single library item task.
 *
 * Executes the full pipeline:
 * 1. Video embedding (Vertex AI) — skipped if already embedded
 * 2. Classification (Claude metadata generation + MongoDB upsert)
 * 3. Downstream chaining (media generation: hash + preview + thumbnail)
 * 4. Library completion check (email + onboarding)
 *
 * @param eventData — job payload from the 'library-item-processing' queue
 */
export async function processLibraryItemProcessingTask(
	eventData: LibraryItemProcessingEventData,
): Promise<void> {
	const { brollId, userId } = eventData;

	logger.info("Starting library item processing", {
		brollId,
		userId,
	});

	// -----------------------------------------------------------------------
	// PHASE 0: Load and validate broll
	// -----------------------------------------------------------------------

	const broll = await BrollFootageMetadata.findById(brollId);
	if (!broll) {
		throw new Error(`Broll not found: ${brollId}`);
	}

	if (broll.isDeleted) {
		logger.info("Broll is deleted, skipping processing", { brollId });
		return;
	}

	if (!broll.url) {
		logger.error("Broll does not have video url", { brollId });
		throw new Error("Broll does not have video url");
	}

	if (
		!broll.thumbnailUrl ||
		!broll.thumbnailUrl2 ||
		!broll.libraryId ||
		broll.isVertical === undefined
	) {
		throw new Error("Broll is missing required fields");
	}

	const prompt = eventData.prompt ?? "";
	const ytVideoDescription = eventData.ytVideoDescription ?? "";

	let embeddingSkipped = false;

	// -----------------------------------------------------------------------
	// PHASE 1: Video Embedding (Vertex AI)
	// -----------------------------------------------------------------------

	try {
		if (broll.hasVideoEmbeddings) {
			logger.debug("Broll already has embeddings, skipping embedding phase", {
				brollId,
			});
			embeddingSkipped = true;
		} else {
			// 1a. Description generation
			let description = broll.title;
			if (!description) {
				logger.debug("Generating description for broll", { brollId });
				const descFn = await getDescriptionGeneratorFn();
				if (!descFn) throw new Error("Description generator not available");
				description = await descFn({
					imageUrl1: broll.thumbnailUrl,
					imageUrl2: broll.thumbnailUrl2 ?? broll.thumbnailUrl,
					prompt,
					videoDescription: ytVideoDescription,
				});
				broll.title = description;
			}

			// 1b. Vertex AI video embedding
			logger.debug("Creating video embeddings via Vertex AI", { brollId });
			const createEmbeddings = await getVideoEmbeddingFn();
			if (!createEmbeddings) throw new Error("Video embedding generator not available");
			const metadata = await createEmbeddings(
				broll.url,
				0,
				60,
				60,
				description.substring(0, 1000),
			);

			// 1c. Combined embedding (95% video + 5% text)
			const videoEmbedding = metadata[0]?.videoEmbeddings[0].embedding ?? [];
			const textEmbedding = metadata[0]?.textEmbedding ?? [];

			let combinedEmbedding: number[] = [];
			if (
				videoEmbedding.length > 0 &&
				textEmbedding.length > 0 &&
				videoEmbedding.length === textEmbedding.length
			) {
				combinedEmbedding = videoEmbedding.map(
					(videoVal: number, index: number) =>
						0.95 * videoVal + 0.05 * textEmbedding[index],
				);
			} else if (videoEmbedding.length > 0) {
				combinedEmbedding = videoEmbedding;
			}

			// 1d. Store in MongoDB
			await BrollFootageMetadata.findByIdAndUpdate(brollId, {
				status: "PROCESSED",
				hasVideoEmbeddings: true,
				videoEmbedding: combinedEmbedding,
				title: broll.title,
			});

			logger.debug("Video embeddings stored in MongoDB", { brollId });
		}
	} catch (e: unknown) {
		logger.error("Error creating embeddings", {
			brollId,
			error: e instanceof Error ? e.message : String(e),
		});
		await BrollFootageMetadata.findByIdAndUpdate(brollId, { status: "FAILED" });
		throw e;
	}

	// -----------------------------------------------------------------------
	// PHASE 2: Classification (Claude metadata generation + MongoDB upsert)
	// -----------------------------------------------------------------------

	try {
		logger.info("Generating classification metadata", { brollId });
		const metadataFn = await getMetadataGeneratorFn();
		if (!metadataFn) throw new Error("Metadata generator not available");
		const metadata = await metadataFn([
			broll.thumbnailUrl,
			broll.thumbnailUrl2,
		]);

		// Upsert metadata to MongoDB
		if (metadata) {
			await BrollFootageMetadata.findByIdAndUpdate(brollId, {
				$set: {
					framing: metadata.framing,
					cameraAngle: metadata.cameraAngle,
					perspective: metadata.perspective,
					depthOfField: metadata.depthOfField,
					complexity: metadata.complexity,
					arollBroll: metadata.arollBroll,
					focusPosition: metadata.focusPosition,
				},
			});
			logger.info("Classification metadata upserted to MongoDB", { brollId });
		}
	} catch (e: unknown) {
		// Handle NSFW detection — delete the video
		const error = e as { code?: string; message?: string };
		if (error.code === "data_inspection_failed") {
			logger.info("The video has NSFW content, triggering deletion", {
				brollId,
			});
			await enqueueLibraryItemDeletionTask({
				brollId,
				userId,
				version: "1.0.0",
			});
			return;
		}

		logger.error("Error during classification", {
			brollId,
			error: e instanceof Error ? e.message : String(e),
		});
		await BrollFootageMetadata.findByIdAndUpdate(brollId, { status: "FAILED" });
		throw e;
	}

	// -----------------------------------------------------------------------
	// PHASE 3: Downstream chaining — media generation
	// -----------------------------------------------------------------------

	// 3a. Enqueue three media generation jobs (hash, preview, thumbnail)
	try {
		const mediaBase = {
			brollId,
			userId,
			version: "1.0.0" as const,
		};

		await enqueueLibraryItemMediaGenerationTask({
			...mediaBase,
			taskType: "hash",
		});
		logger.debug("Hash generation job enqueued", { brollId });

		await enqueueLibraryItemMediaGenerationTask({
			...mediaBase,
			taskType: "preview",
		});
		logger.debug("Preview generation job enqueued", { brollId });

		await enqueueLibraryItemMediaGenerationTask({
			...mediaBase,
			taskType: "thumbnail",
			prompt,
			videoDescription: ytVideoDescription,
		});
		logger.debug("Thumbnail generation job enqueued", { brollId });
	} catch (e: unknown) {
		logger.error("Failed to enqueue media generation jobs", {
			brollId,
			error: e instanceof Error ? e.message : String(e),
		});
		// Non-fatal — don't fail the whole job
	}

	// -----------------------------------------------------------------------
	// PHASE 4: Library completion check (always runs)
	// -----------------------------------------------------------------------

	try {
		await checkAndSendEmail(broll.libraryId);
	} catch (e: unknown) {
		logger.error("Error during library completion check", {
			libraryId: broll.libraryId,
			error: e instanceof Error ? e.message : String(e),
		});
		// Non-fatal — don't fail the whole job
	}

	logger.info("Library item processing completed", {
		brollId,
		userId,
		embeddingSkipped,
	});
}

// ---------------------------------------------------------------------------
// Library completion check — email, clustering, onboarding
// ---------------------------------------------------------------------------

/**
 * Check if all brolls in a library have been processed. If so, triggers
 * downstream actions: email notification and onboarding flow.
 */
async function checkAndSendEmail(libraryId: string): Promise<void> {
	if (!libraryId) return;

	const pendingBrollCount = await BrollFootageMetadata.countDocuments({
		libraryId,
		isDeleted: { $ne: true },
		hasVideoEmbeddings: { $ne: true },
		status: { $ne: "FAILED" },
	});

	if (pendingBrollCount > 0) {
		logger.debug("Brolls still pending, skipping completion check", {
			pending: pendingBrollCount,
		});
		return;
	}

	const libraryForProgress = await Library.findOne({ _id: libraryId });
	if (
		libraryForProgress &&
		calculateTotalProgress(libraryForProgress) !== 100
	) {
		logger.warn("Library not fully processed yet", { libraryId });
		return;
	}

	const library = await Library.findOneAndUpdate(
		{
			_id: libraryId,
			"asyncProgress.emailSent": { $ne: true },
			status: "TAGGING",
		},
		{ $set: { "asyncProgress.emailSent": true, status: "PROCESSED" } },
	);

	if (!library) {
		logger.warn("Library not found or email already sent", { libraryId });
		return;
	}

	// One-shot pipeline: if a video generation job is waiting on this library
	if (library.pendingOneShotJob) {
		const { prompt, tjId } = library.pendingOneShotJob as {
			prompt: string;
			tjId: string;
		};
		logger.debug(
			"Library has pending one-shot job, enqueueing video generation",
			{ libraryId, tjId },
		);
		try {
			await enqueueLambdaVideoGenerationTask({
				guidance: prompt,
				userId: library.userId,
				tjId,
				title: prompt.slice(0, 100),
				script: prompt,
				privateLibraryIds: [library._id.toString()],
				publicLibraryIds: [],
				version: "3.0.0",
				uploadType: "prompt",
				size: "1080p",
				orientation: "HORIZONTAL",
				brollDuration: 3.5,
				includeMusic: false,
				isTalkingHead: false,
				isVoicePremium: true,
				voiceType: "tcpgAjiYQlAiZ267Oflu",
				libraries: { pexels: false },
				isAllPublicLibrariesSelected: true,
				isOneShotJob: true,
			});
		} catch (err) {
			logger.error("Failed to enqueue one-shot video generation", {
				error: err,
				libraryId,
				tjId,
			});
		}
		return;
	}

	// Check onboarding flow
	const shouldTriggerOnboardingFlow = await checkIfOnboardingFlow(
		library.userId,
		library._id.toString(),
	);

	if (shouldTriggerOnboardingFlow) {
		logger.debug(
			"Library is part of onboarding flow, generating sample video",
			{
				libraryId: library._id.toString(),
				userId: library.userId,
			},
		);
		await generateOnboardingVideo(
			library.userId,
			library._id.toString(),
			library.title,
		);
	}

	// Save notification
	await new Notification({
		userId: library.userId,
		type: "LIBRARY_POPULATED",
		title: "Library Populated!",
		message: `Your library ${library.title} is ready to use!`,
		links: [{ linkType: "LIBRARY", docId: library._id }],
	}).save();
}

/**
 * Check if the library processing should trigger onboarding flow.
 * Returns true if this is the user's first library (not including NEW/DELETED status).
 */
async function checkIfOnboardingFlow(
	userId: string,
	libraryId: string,
): Promise<boolean> {
	try {
		const totalVideos = await videoAiDataRepository.getVideoCount(userId);
		return totalVideos === 0;
	} catch (error) {
		logger.error("Error checking onboarding flow conditions", {
			error,
			userId,
			libraryId,
		});
		return false;
	}
}

/**
 * Generate a sample video for onboarding using the library content.
 */
async function generateOnboardingVideo(
	userId: string,
	libraryId: string,
	libraryTitle: string,
): Promise<void> {
	try {
		logger.debug("Starting onboarding video generation", { userId, libraryId });

		const transcriptionJob = new TranscriptionJob({
			userId,
			title: `Sample Video from ${libraryTitle}`,
			jobType: "SCRIPT",
			status: "VIDEO_RECEIVED",
		});
		await transcriptionJob.save();

		const tjId = transcriptionJob._id.toString();

		const videoGenerationEventData: VideoGenerationEventDataV3 = {
			guidance: "Infer video based on library",
			userId,
			script: "Infer video based on available footage",
			title: `Sample Video from ${libraryTitle}`,
			tjId,
			uploadType: "prompt",
			size: "1080p",
			brollDuration: 3.5,
			includeMusic: false,
			isTalkingHead: false,
			isVoicePremium: false,
			voiceType: "alloy",
			privateLibraryIds: [libraryId],
			publicLibraryIds: [],
			libraries: {
				pexels: false,
			},
			version: "3.0.0",
			isAllPublicLibrariesSelected: false,
			exportConfig: {
				userId,
				exportType: "VIDEO_CAPTIONS",
				orientationType: "VERTICAL",
				isWatermarked: false,
				status: "QUEUED",
			},
		};

		await enqueueLambdaVideoGenerationTask(videoGenerationEventData);

		logger.debug("Onboarding video generation task enqueued", {
			userId,
			libraryId,
			tjId,
		});
	} catch (error) {
		logger.error("Error generating onboarding video", {
			error,
			userId,
			libraryId,
		});

	}
}
