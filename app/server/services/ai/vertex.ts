/**
 * Google Vertex AI integration — multimodal embeddings (video + text).
 *
 * Provides both text-only and video+text embedding via the
 * multimodalembedding@001 model. Used by the library-item-processing
 * BullMQ worker for video embedding generation.
 */

import { fromValue, toValue } from "@google-cloud/aiplatform/build/src/helpers";
import { PredictionServiceClient } from "@google-cloud/aiplatform/build/src/v1/prediction_service_client";
import { Storage } from "@google-cloud/storage";
import fs from "fs";
import { nanoid } from "nanoid";
import path from "path";
import { logger } from "server/services/logging";
import { retry } from "../../utils/retry-fn";
import { downloadFile, safelyDelete, safelyDeleteDir } from "../fs";

const project = "stellar-cipher-453613-d8";
const LOCATION = "us-west1";
const publisher = "google";
const model = "multimodalembedding@001";

// ---------------------------------------------------------------------------
// Client initialization — shared across text and video embedding calls.
// Lazy so the server can boot without .vertex-key.json; only embedding
// calls require the key file.
// ---------------------------------------------------------------------------

const VERTEX_KEY_PATH = process.env.VERTEX_KEY_PATH || "./.vertex-key.json";

function readVertexCredentials() {
	return JSON.parse(fs.readFileSync(VERTEX_KEY_PATH, "utf8"));
}

let _predictionServiceClient: PredictionServiceClient | undefined;
function getPredictionServiceClient(): PredictionServiceClient {
	if (!_predictionServiceClient) {
		_predictionServiceClient = new PredictionServiceClient({
			apiEndpoint: `${LOCATION}-aiplatform.googleapis.com`,
			credentials: readVertexCredentials(),
		});
	}
	return _predictionServiceClient;
}

// Google Cloud Storage client for video upload to Vertex AI
const GCS_BUCKET_NAME = "bucket-video-embedding";

let _gcsBucket: ReturnType<Storage["bucket"]> | undefined;
function getGcsBucket() {
	if (!_gcsBucket) {
		const storage = new Storage({ credentials: readVertexCredentials() });
		_gcsBucket = storage.bucket(GCS_BUCKET_NAME);
	}
	return _gcsBucket;
}
type TextEmbeddingReturnType = {
	textEmbedding: number[];
}[];

export async function createTextEmbeddings(
	text: string,
): Promise<TextEmbeddingReturnType> {
	return await retry(
		async () => {
			// Configure the parent resource
			const endpoint = `projects/${project}/locations/${LOCATION}/publishers/${publisher}/models/${model}`;

			// Convert the image data to a Buffer and base64 encode it.

			const prompt = {
				text: text.substring(0, 1000),
			};
			const instanceValue = toValue(prompt);
			const instances = [instanceValue!];

			const parameter = {
				sampleCount: 1,
			};
			const parameters = toValue(parameter);

			const request = {
				endpoint,
				instances,
				parameters,
			};

			// Predict request
			const [response] = await getPredictionServiceClient().predict(request);
			const predictions = response.predictions ?? [];
			return predictions.map((p) => fromValue(p as any)) as any;
		},
		{
			maxAttempts: 5,
			delayMs: 1000,
			exponentialBackoff: true,
			onRetry: (error, attempt) => {
				logger.error(
					`Error creating text embeddings, retrying (attempt ${attempt}/5):`,
					error.message,
				);
			},
		},
	);
}

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export type VideoEmbeddingResult = {
	videoEmbeddings: {
		startOffsetSec: number;
		endOffsetSec: number;
		embedding: number[];
	}[];
	textEmbedding?: number[];
}[];

// ---------------------------------------------------------------------------
// GCS helpers — upload video to GCS for Vertex AI processing
// ---------------------------------------------------------------------------

/**
 * Upload a local file to GCS and return the gs:// URI.
 */
async function uploadToGCS(filePath: string): Promise<string> {
	const fileName = `${nanoid()}-${path.basename(filePath)}`;
	const file = getGcsBucket().file(fileName);

	const writeStream = file.createWriteStream({
		metadata: {
			cacheControl: "no-cache",
			expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour TTL
		},
	});

	await new Promise<void>((resolve, reject) => {
		const readStream = fs.createReadStream(filePath);
		readStream.pipe(writeStream);

		writeStream.on("error", reject);
		writeStream.on("finish", async () => {
			try {
				await file.setMetadata({
					metadata: { ttl: "3600" },
				});
				resolve();
			} catch (err) {
				reject(err);
			}
		});
	});

	return `gs://${GCS_BUCKET_NAME}/${fileName}`;
}

// ---------------------------------------------------------------------------
// Video embedding — download video, upload to GCS, call Vertex AI, cleanup
// ---------------------------------------------------------------------------

/**
 * Generate video + text embeddings via Google Vertex AI multimodalembedding@001.
 *
 * Downloads the video from the provided URL, uploads to GCS, calls the
 * Vertex AI prediction service, and cleans up all temporary files.
 *
 * @param baseVideoPath — S3 URL or local path to the video
 * @param startOffsetSec — start of the segment to embed
 * @param endOffsetSec — end of the segment to embed
 * @param intervalSec — interval between samples within the segment
 * @param text — optional text to embed alongside the video
 */
export async function createVideoEmbeddings(
	baseVideoPath: string,
	startOffsetSec: number,
	endOffsetSec: number,
	intervalSec: number,
	text?: string,
): Promise<VideoEmbeddingResult> {
	const folder = `/tmp/${nanoid()}`;
	fs.mkdirSync(folder, { recursive: true });
	const videoPath = `${folder}/${new Date().getTime()}${path.extname(baseVideoPath)}`;

	await downloadFile(videoPath, baseVideoPath);

	try {
		const gcsUri = await uploadToGCS(videoPath);
		const endpoint = `projects/${project}/locations/${LOCATION}/publishers/${publisher}/models/${model}`;

		const prompt: Record<string, unknown> = {
			video: {
				gcsUri,
				videoSegmentConfig: {
					startOffsetSec,
					endOffsetSec,
					intervalSec,
				},
			},
		};

		if (text) {
			prompt.text = text.substring(0, 1000);
		}

		const instanceValue = toValue(prompt);
		const parameter = toValue({ sampleCount: 1 });

		const request = {
			endpoint,
			instances: [instanceValue!],
			parameters: parameter,
		};

		return await retry(
			async () => {
				const [response] = await getPredictionServiceClient().predict(request);
				const predictions = response.predictions ?? [];
				return predictions.map((p) =>
					fromValue(p as any),
				) as VideoEmbeddingResult;
			},
			{
				maxAttempts: 5,
				delayMs: 2000,
				exponentialBackoff: true,
				onRetry: (error, attempt) => {
					logger.error(
						`Error creating video embeddings, retrying (attempt ${attempt}/5):`,
						error.message,
					);
				},
			},
		);
	} finally {
		safelyDelete(videoPath);
		safelyDeleteDir(folder);
	}
}
