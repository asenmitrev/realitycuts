import { Worker } from "bullmq";
import type { Redis } from "ioredis";
import { logger } from "../logging";
import {
	closeRedisConnection,
	getRedisConnection,
	getRedisPrefix,
} from "./connection";
import { closeAllQueues, getQueue } from "./queues";
import {
	type JobPayloadMap,
	QUEUE_CONCURRENCY,
	QUEUE_NAMES,
	type QueueName,
	WORKER_SETTINGS,
} from "./types";

// ---------------------------------------------------------------------------
// Worker handler registry — maps queue names to their processing functions.
//
// For Phase 0 testing we start with just the video generation handler.
// Additional handlers are wired in as phases progress.
// ---------------------------------------------------------------------------

// Lazy-import processors to avoid pulling in heavy dependencies at module
// load time (e.g., ffmpeg, LLM clients). The worker calls this on each job.
// We import from the server services directly — the Lambda's handlers live in
// functions/ which is a separate workspace.
let processVideoGenerationTask:
	| ((data: JobPayloadMap["video-generation"]) => Promise<void>)
	| null = null;

async function getVideoGenerationHandler() {
	if (!processVideoGenerationTask) {
		const { processVideoGenerationTask: handler } = await import(
			"../video-generation-processor.js"
		);
		processVideoGenerationTask = handler;
	}
	return processVideoGenerationTask;
}

let processLibraryProcessingJob:
	| ((data: JobPayloadMap["library-processing"]) => Promise<void>)
	| null = null;

async function getLibraryProcessingHandler() {
	if (!processLibraryProcessingJob) {
		const { processLibraryProcessingJob: handler } = await import(
			"./local-task-processor.js"
		);
		processLibraryProcessingJob = handler;
	}
	return processLibraryProcessingJob;
}

let processLibraryItemDeletionTask:
	| ((data: JobPayloadMap["library-item-deletion"]) => Promise<void>)
	| null = null;

async function getLibraryItemDeletionHandler() {
	if (!processLibraryItemDeletionTask) {
		const { processLibraryItemDeletionTask: handler } = await import(
			"./library-item-deletion-processor.js"
		);
		processLibraryItemDeletionTask = handler;
	}
	return processLibraryItemDeletionTask;
}

let processLibraryItemProcessingTask:
	| ((data: JobPayloadMap["library-item-processing"]) => Promise<void>)
	| null = null;

async function getLibraryItemProcessingHandler() {
	if (!processLibraryItemProcessingTask) {
		const { processLibraryItemProcessingTask: handler } = await import(
			"./library-item-processing-processor.js"
		);
		processLibraryItemProcessingTask = handler;
	}
	return processLibraryItemProcessingTask;
}

let processLibraryItemMediaTask:
	| ((data: JobPayloadMap["library-item-media-generation"]) => Promise<void>)
	| null = null;

async function getLibraryItemMediaHandler() {
	if (!processLibraryItemMediaTask) {
		const { processLibraryItemMediaTask: handler } = await import(
			"./library-item-media-processor.js"
		);
		processLibraryItemMediaTask = handler;
	}
	return processLibraryItemMediaTask;
}

// ---------------------------------------------------------------------------
// Export task handlers (main exporter, fcpxml)
// ---------------------------------------------------------------------------

let processExportJobTask: ((data: JobPayloadMap["exporter"]) => Promise<void>) | null = null;

async function getExportJobHandler() {
	if (!processExportJobTask) {
		const { processExportJobTask: handler } = await import("./export-job-processor.js");
		processExportJobTask = handler;
	}
	return processExportJobTask;
}

// ---------------------------------------------------------------------------
// Export task handlers (fcpxml)
// ---------------------------------------------------------------------------

let processFCPXMLExportTask: ((data: JobPayloadMap["fcpxml-export"]) => Promise<void>) | null = null;

async function getFCPXMLExportHandler() {
	if (!processFCPXMLExportTask) {
		const { processFCPXMLExportTask: handler } = await import("./export-processor.js");
		processFCPXMLExportTask = handler;
	}
	return processFCPXMLExportTask;
}

// ---------------------------------------------------------------------------
// Chat video finalization handler
// ---------------------------------------------------------------------------

let processChatVideoFinalizationTask: ((data: JobPayloadMap["chat-video-finalization"]) => Promise<void>) | null = null;

async function getChatVideoFinalizationHandler() {
	if (!processChatVideoFinalizationTask) {
		const { processChatVideoFinalizationTaskBullMQ: handler } = await import("./chat-video-finalization-processor.js");
		processChatVideoFinalizationTask = handler;
	}
	return processChatVideoFinalizationTask;
}

// ---------------------------------------------------------------------------
// Automation source processing handler
// ---------------------------------------------------------------------------

let processAutomationSourcePageTask:
    | ((data: JobPayloadMap["automation-source-processing"]) => Promise<void>)
    | null = null;

async function getAutomationSourcePageHandler() {
    if (!processAutomationSourcePageTask) {
        const { processAutomationSourcePageTask: handler } = await import(
            "./automation-source-processing-processor.js"
        );
        processAutomationSourcePageTask = handler;
    }
    return processAutomationSourcePageTask;
}

// ---------------------------------------------------------------------------
// Chapter pipeline handlers
// ---------------------------------------------------------------------------

let processChapterDetectionTask:
	| ((data: JobPayloadMap["chapter-detection"]) => Promise<void>)
	| null = null;

async function getChapterDetectionHandler() {
	if (!processChapterDetectionTask) {
		const { processChapterDetectionTask: handler } = await import(
			"./chapter-detection-processor.js"
		);
		processChapterDetectionTask = handler;
	}
	return processChapterDetectionTask;
}

let processChapterScriptTask:
	| ((data: JobPayloadMap["chapter-script"]) => Promise<void>)
	| null = null;

async function getChapterScriptHandler() {
	if (!processChapterScriptTask) {
		const { processChapterScriptTask: handler } = await import(
			"./chapter-script-processor.js"
		);
		processChapterScriptTask = handler;
	}
	return processChapterScriptTask;
}

// ---------------------------------------------------------------------------
// Automation checker handler
// ---------------------------------------------------------------------------

let checkDueAutomations: (() => Promise<void>) | null = null;

async function getAutomationCheckHandler() {
	if (!checkDueAutomations) {
		const { checkDueAutomations: handler } = await import(
			"../automation-checker.service.js"
		);
		checkDueAutomations = handler;
	}
	return checkDueAutomations;
}

/**
 * Handler map: queue name → async function that processes the job payload.
 */
const HANDLERS: Partial<
	Record<QueueName, (payload: unknown) => Promise<void>>
> = {
	"video-generation": async (payload) => {
		const handler = await getVideoGenerationHandler();
		if (!handler) throw new Error("Video generation handler not available");
		return handler(payload as JobPayloadMap["video-generation"]);
	},
	"library-processing": async (payload) => {
		const handler = await getLibraryProcessingHandler();
		if (!handler) throw new Error("Library processing handler not available");
		return handler(payload as JobPayloadMap["library-processing"]);
	},
	"library-item-deletion": async (payload) => {
		const handler = await getLibraryItemDeletionHandler();
		if (!handler)
			throw new Error("Library item deletion handler not available");
		return handler(payload as JobPayloadMap["library-item-deletion"]);
	},
	"library-item-processing": async (payload) => {
		const handler = await getLibraryItemProcessingHandler();
		if (!handler)
			throw new Error("Library item processing handler not available");
		return handler(payload as JobPayloadMap["library-item-processing"]);
	},
	"library-item-media-generation": async (payload) => {
		const handler = await getLibraryItemMediaHandler();
		if (!handler)
			throw new Error("Library item media handler not available");
		return handler(payload as JobPayloadMap["library-item-media-generation"]);
	},
	// Export queues
	"exporter": async (payload) => {
		const handler = await getExportJobHandler();
		if (!handler) throw new Error("Export job handler not available");
		return handler(payload as JobPayloadMap["exporter"]);
	},
	"fcpxml-export": async (payload) => {
		const handler = await getFCPXMLExportHandler();
		if (!handler) throw new Error("FCPXML export handler not available");
		return handler(payload as JobPayloadMap["fcpxml-export"]);
	},
	"chat-video-finalization": async (payload) => {
		const handler = await getChatVideoFinalizationHandler();
		if (!handler)
			throw new Error("Chat video finalization handler not available");
		return handler(payload as JobPayloadMap["chat-video-finalization"]);
	},
	"chapter-detection": async (payload) => {
		const handler = await getChapterDetectionHandler();
		if (!handler) throw new Error("Chapter detection handler not available");
		return handler(payload as JobPayloadMap["chapter-detection"]);
	},
	"chapter-script": async (payload) => {
		const handler = await getChapterScriptHandler();
		if (!handler) throw new Error("Chapter script handler not available");
		return handler(payload as JobPayloadMap["chapter-script"]);
	},
	"automation-source-processing": async (payload) => {
		const handler = await getAutomationSourcePageHandler();
		if (!handler)
			throw new Error("Automation source processing handler not available");
		return handler(payload as JobPayloadMap["automation-source-processing"]);
	},
	"automation-check": async () => {
		const handler = await getAutomationCheckHandler();
		if (!handler) throw new Error("Automation check handler not available");
		return handler();
	},
};

// ---------------------------------------------------------------------------
// Worker instances — one Worker per queue that has a handler.
// ---------------------------------------------------------------------------

const workerInstances = new Map<QueueName, Worker>();

/**
 * Start a BullMQ Worker for a specific queue.
 */
async function startWorker(queueName: QueueName): Promise<Worker | null> {
	const handler = HANDLERS[queueName];
	if (!handler) {
		logger.info(
			`Skipping worker for queue "${queueName}" — no handler registered yet`,
		);
		return null;
	}

	const connection = await getRedisConnection();
	const queue = await getQueue(queueName);

	const worker = new Worker(
		queueName,
		async (job) => {
			logger.info(`Worker processing job`, {
				queue: queueName,
				jobId: job.id,
				attempt: job.attemptsMade,
			});
			await handler(job.data);
		},
		{
			connection,
			prefix: getRedisPrefix(),
			concurrency: QUEUE_CONCURRENCY[queueName],
			limiter:
				queueName === "video-generation"
					? { max: 2, duration: 60_000 }
					: undefined,
			stalledInterval: WORKER_SETTINGS.stalledInterval,
			maxStalledCount: WORKER_SETTINGS.maxStalledCount,
		},
	);

	// Event handlers for monitoring
	worker.on("completed", (job) => {
		logger.info(`Job completed`, { queue: queueName, jobId: job?.id });
	});

	worker.on("failed", (job, err) => {
		logger.error(`Job failed`, {
			queue: queueName,
			jobId: job?.id,
			attempt: job?.attemptsMade,
			maxAttempts: job?.opts?.attempts,
			error: err.message,
		});
	});

	worker.on("error", (err) => {
		logger.error(`Worker error`, { queue: queueName, error: err.message });
	});

	workerInstances.set(queueName, worker);
	logger.info(
		`Worker started: ${queueName} (concurrency: ${QUEUE_CONCURRENCY[queueName]})`,
	);
	return worker;
}

/**
 * Start all registered workers. Only queues with handlers will actually run.
 *
 * @param queueFilter — optional subset of queues to start (useful for testing)
 */
export async function startWorkers(queueFilter?: QueueName[]): Promise<void> {
	const queuesToStart =
		queueFilter ??
		(Object.keys(HANDLERS) as QueueName[]).filter(
			(k) => HANDLERS[k] !== undefined,
		);

	const connection = await getRedisConnection();
	// Verify Redis is reachable before starting workers
	await connection.ping();

	const results = await Promise.allSettled(
		queuesToStart.map((q) => startWorker(q)),
	);

	for (let i = 0; i < results.length; i++) {
		const result = results[i];
		const queue = queuesToStart[i];
		if (result.status === "rejected") {
			logger.error(`Failed to start worker for queue ${queue}`, {
				error: result.reason,
			});
		}
	}

	logger.info(
		`Workers initialization complete (${queuesToStart.length} queues targeted)`,
	);
}

/**
 * Registers the recurring automation-check job. Replaces the old CDK
 * EventBridge rule (`rate(5 minutes)`) that used to trigger the
 * automation-checker Lambda. BullMQ dedupes repeatable jobs by their
 * repeat key, so calling this on every server boot is safe.
 */
export async function scheduleAutomationCheckerJob(): Promise<void> {
	const queue = await getQueue(QUEUE_NAMES.AUTOMATION_CHECK);
	await queue.add(
		"automation-check",
		{},
		{
			repeat: { every: 5 * 60 * 1000 },
			jobId: "automation-check-repeatable",
		},
	);
	logger.info("Automation checker repeatable job scheduled (every 5 minutes)");
}

/**
 * Stop all workers gracefully — drains in-progress jobs before closing.
 */
export async function stopWorkers(): Promise<void> {
	logger.info("Stopping all workers...");

	await Promise.allSettled(
		Array.from(workerInstances.values()).map((worker) => worker.close()),
	);
	workerInstances.clear();
	logger.info("All workers stopped");
}

/**
 * Full shutdown: stop workers → close queues → close Redis.
 */
export async function shutdown(): Promise<void> {
	await stopWorkers();
	await closeAllQueues();
	await closeRedisConnection();
	logger.info("BullMQ shutdown complete");
}
