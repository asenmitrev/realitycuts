/**
 * BullMQ job payload types.
 *
 * Each queue name maps to exactly one payload type. Handlers live in
 * workers.ts and process jobs locally via BullMQ workers.
 */

import type {
	AutomationSourcePageProcessingEventData,
	ChapterDetectionEventData,
	ChapterScriptEventData,
	ChatVideoFinalizationEventData,
	ExportJobEventData,
	FCPXMLExportEventData,
	LibraryImportEventData,
	LibraryItemDeletionEventData,
	LibraryItemMediaGenerationEventData,
	LibraryItemProcessingEventData,
	VideoGenerationEventData,
} from "shared/types/event-contracts";

export const QUEUE_NAMES = {
	LIBRARY_PROCESSING: "library-processing",
	LIBRARY_ITEM_PROCESSING: "library-item-processing",
	LIBRARY_ITEM_DELETION: "library-item-deletion",
	LIBRARY_ITEM_MEDIA_GENERATION: "library-item-media-generation",
	LIBRARY_IMPORT: "library-import",
	EXPORTER: "exporter",
	FCPXML_EXPORT: "fcpxml-export",
	CHAT_VIDEO_FINALIZATION: "chat-video-finalization",
	VIDEO_GENERATION: "video-generation",
	AUTOMATION_SOURCE_PROCESSING: "automation-source-processing",
	CHAPTER_DETECTION: "chapter-detection",
	CHAPTER_SCRIPT: "chapter-script",
	AUTOMATION_CHECK: "automation-check",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// ---------------------------------------------------------------------------
// Job payload type map — each queue name → its payload type.
// ---------------------------------------------------------------------------

export interface JobPayloadMap {
	"library-processing": {
		type: "LIBRARY_PROCESSOR";
		payload: Record<string, unknown>;
		dedupeId: string;
	};
	"library-item-processing": LibraryItemProcessingEventData;
	"library-item-deletion": LibraryItemDeletionEventData;
	"library-item-media-generation": LibraryItemMediaGenerationEventData;
	"library-import": LibraryImportEventData;
	"exporter": ExportJobEventData;
	"fcpxml-export": FCPXMLExportEventData;
	"chat-video-finalization": ChatVideoFinalizationEventData;
	"video-generation": VideoGenerationEventData;
	"automation-source-processing": AutomationSourcePageProcessingEventData;
	"chapter-detection": ChapterDetectionEventData;
	"chapter-script": ChapterScriptEventData;
	"automation-check": Record<string, never>;
}

// ---------------------------------------------------------------------------
// Concurrency settings — mapped from Lambda reservedConcurrentExecutions.
// ---------------------------------------------------------------------------

export const QUEUE_CONCURRENCY: Record<QueueName, number> = {
	"library-processing": 1,
	"library-item-processing": 10,
	"library-item-deletion": 5,
	"library-item-media-generation": 20,
	// Low concurrency: each job streams a whole ZIP's worth of media through a single
	// worker process on one box, so a few can run at once without saturating disk/network.
	"library-import": 2,
	"exporter": 5,
	"fcpxml-export": 5,
	"chat-video-finalization": 10,
	"video-generation": 10,
	"automation-source-processing": 10,
	"chapter-detection": 5,
	"chapter-script": 5,
	"automation-check": 1,
};

// ---------------------------------------------------------------------------
// Default job settings — applied per-queue unless overridden.
// ---------------------------------------------------------------------------

export const DEFAULT_JOB_SETTINGS = {
	attempts: 3,
	backoff: {
		type: "exponential" as const,
		delay: 5_000,
	},
	removeOnComplete: {
		count: 100, // keep last 100 completed jobs for debugging
	},
	removeOnFail: {
		count: 500, // keep last 500 failed jobs for analysis
	},
};

// ---------------------------------------------------------------------------
// Global BullMQ worker settings.
// ---------------------------------------------------------------------------

export const WORKER_SETTINGS = {
	stalledInterval: 30_000, // detect stalled jobs every 30s
	maxStalledCount: 1, // reprocess stalled job once before moving to failed
};
