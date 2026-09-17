/**
 * Task queue service — BullMQ-based task enqueuing.
 *
 * Previously routed through AWS SQS + Lambda. Now all enqueueing
 * goes directly to BullMQ queues processed by local workers.
 */

import type {
  AutomationSourcePageProcessingEventData,
  ChapterDetectionEventData,
  ChapterScriptEventData,
  ChatVideoFinalizationEventData,
  ExportJobEventData,
  FCPXMLExportEventData,
  LibraryClusteringEventData,
  LibraryImportEventData,
  LibraryItemClassificationEventData,
  LibraryItemDeletionEventData,
  LibraryItemMediaGenerationEventData,
  LibraryItemProcessingEventData,
  LibraryItemThumbnailGenerationEventData,
  LibraryItemVideoEmbeddingEventData,
  VideoGenerationEventData,
  YouTubeUploadEventData,
} from "shared/types/event-contracts";
import { logger } from "./logging";

/**
 * Enqueue a library processing task via BullMQ.
 */
export async function enqueueLibraryTaskBullMQ(
  libraryId: string,
  settingsId: string,
) {
  try {
    const { getQueue } = await import("./bullmq/queues.js");
    const { QUEUE_NAMES } = await import("./bullmq/types.js");
    const queue = await getQueue(QUEUE_NAMES.LIBRARY_PROCESSING);

    const job = await queue.add(
      "library-processing",
      {
        type: "LIBRARY_PROCESSOR",
        payload: {
          libraryId,
          settingsId,
          version: "2.0.0",
        },
        dedupeId: `library-${libraryId}-${Date.now()}`,
      },
      {
        jobId: `library-${libraryId}-${settingsId}`,
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 10_000,
        },
      },
    );

    logger.info("Library task enqueued via BullMQ", {
      libraryId,
      settingsId,
      jobId: job.id,
    });

    return { method: "bullmq", jobId: job.id };
  } catch (error) {
    logger.error("Error enqueuing library task via BullMQ", {
      libraryId,
      settingsId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

/**
 * Enqueue an export job via BullMQ.
 */
export async function enqueueExporterTaskBullMQ(exportJobId: string) {
  try {
    const { getQueue } = await import("./bullmq/queues.js");
    const { QUEUE_NAMES } = await import("./bullmq/types.js");
    const queue = await getQueue(QUEUE_NAMES.EXPORTER);

    const eventData: ExportJobEventData = {
      exportJobId,
      version: "1.0.0",
    };

    const job = await queue.add("export-job", eventData, {
      jobId: `export-${exportJobId}`,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 10_000,
      },
    });

    logger.info("Export job enqueued via BullMQ", {
      exportJobId,
      jobId: job.id,
    });

    return { method: "bullmq", jobId: job.id };
  } catch (error) {
    logger.error("Error enqueuing export job via BullMQ", {
      exportJobId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

/**
 * Enqueue a YouTube upload for a completed export job via BullMQ.
 */
export async function enqueueYouTubeUploadTaskBullMQ(exportJobId: string) {
  try {
    const { getQueue } = await import("./bullmq/queues.js");
    const { QUEUE_NAMES } = await import("./bullmq/types.js");
    const queue = await getQueue(QUEUE_NAMES.YOUTUBE_UPLOAD);

    const eventData: YouTubeUploadEventData = {
      exportJobId,
      version: "1.0.0",
    };

    const job = await queue.add("youtube-upload", eventData, {
      jobId: `youtube-upload-${exportJobId}`,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 10_000,
      },
    });

    logger.info("YouTube upload task enqueued via BullMQ", {
      exportJobId,
      jobId: job.id,
    });

    return { method: "bullmq", jobId: job.id };
  } catch (error) {
    logger.error("Error enqueuing YouTube upload task via BullMQ", {
      exportJobId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

/**
 * @deprecated Classification is now handled internally by the unified
 * library-item-processing BullMQ worker.
 */
export async function enqueueLibraryItemClassificationTask(
  eventData: LibraryItemClassificationEventData,
) {
  try {
    const { getQueue } = await import("./bullmq/queues.js");
    const { QUEUE_NAMES } = await import("./bullmq/types.js");
    const queue = await getQueue(QUEUE_NAMES.LIBRARY_ITEM_PROCESSING);

    const payload =
      "brollId" in eventData
        ? {
            brollId: eventData.brollId,
            userId: eventData.userId,
            prompt: eventData.prompt,
            ytVideoDescription: eventData.ytVideoDescription,
            version: "1.0.0" as const,
          }
        : {
            brollId: "",
            userId: eventData.userId,
            prompt: eventData.prompt,
            ytVideoDescription: eventData.videoDescription,
            version: "1.0.0" as const,
          };

    const job = await queue.add("library-item-processing", payload, {
      jobId: `classification-${payload.brollId}-${Date.now()}`,
    });
    logger.debug("Library item classification routed via BullMQ", {
      jobId: job.id,
    });
    return { MessageId: job.id };
  } catch (error) {
    logger.error("Error routing classification to BullMQ:", error);
    throw error;
  }
}

export async function enqueueLibraryItemThumbnailGenerationTask(
  eventData: LibraryItemThumbnailGenerationEventData,
) {
  try {
    const { getQueue } = await import("./bullmq/queues.js");
    const { QUEUE_NAMES } = await import("./bullmq/types.js");
    const queue = await getQueue(QUEUE_NAMES.LIBRARY_ITEM_MEDIA_GENERATION);

    const mediaEvent: LibraryItemMediaGenerationEventData = {
      brollId: eventData.brollId,
      userId: eventData.userId,
      taskType: "thumbnail",
      prompt: eventData.prompt,
      videoDescription: eventData.videoDescription,
      version: "1.0.0",
    };

    const job = await queue.add(
      "media-generation",
      mediaEvent,
      {
        jobId: `thumbnail-${eventData.brollId}-${Date.now()}`,
      },
    );
    logger.debug("Thumbnail generation routed via BullMQ", {
      jobId: job.id,
      brollId: eventData.brollId,
    });
    return { MessageId: job.id };
  } catch (error) {
    logger.error("Error routing thumbnail generation to BullMQ:", error);
    throw error;
  }
}

export async function enqueueLibraryItemMediaGenerationTask(
  eventData: LibraryItemMediaGenerationEventData,
) {
  try {
    const { getQueue } = await import("./bullmq/queues.js");
    const { QUEUE_NAMES } = await import("./bullmq/types.js");
    const queue = await getQueue(QUEUE_NAMES.LIBRARY_ITEM_MEDIA_GENERATION);

    const job = await queue.add(
      "media-generation",
      eventData,
      {
        jobId: `${eventData.taskType}-${eventData.brollId}-${Date.now()}`,
      },
    );
    logger.debug("Media generation job enqueued via BullMQ", {
      jobId: job.id,
      brollId: eventData.brollId,
      taskType: eventData.taskType,
    });
    return { MessageId: job.id };
  } catch (error) {
    logger.error("Error enqueuing media generation job via BullMQ", {
      brollId: eventData.brollId,
      taskType: eventData.taskType,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

export async function enqueueLibraryItemVideoEmbeddingTask(
  eventData: LibraryItemVideoEmbeddingEventData,
) {
  try {
    const { getQueue } = await import("./bullmq/queues.js");
    const { QUEUE_NAMES } = await import("./bullmq/types.js");
    const queue = await getQueue(QUEUE_NAMES.LIBRARY_ITEM_PROCESSING);
    const job = await queue.add(
      "library-item-processing",
      {
        brollId: eventData.brollId,
        userId: eventData.userId,
        prompt: eventData.prompt,
        ytVideoDescription: eventData.ytVideoDescription,
        version: "1.0.0",
      },
      {
        jobId: `processing-${eventData.brollId}-${Date.now()}`,
      },
    );
    logger.debug("Library item processing job enqueued via BullMQ", {
      jobId: job.id,
      brollId: eventData.brollId,
    });
    return { MessageId: job.id };
  } catch (error) {
    logger.error("Error enqueuing library item processing job via BullMQ:", error);
    throw error;
  }
}

export async function enqueueLambdaVideoGenerationTask(
  eventData: VideoGenerationEventData,
) {
  try {
    const { getQueue } = await import("./bullmq/queues.js");
    const { QUEUE_NAMES } = await import("./bullmq/types.js");
    const queue = await getQueue(QUEUE_NAMES.VIDEO_GENERATION);
    const job = await queue.add("video-generation", eventData, {
      jobId: eventData.tjId,
    });
    logger.debug("Video generation job enqueued via BullMQ", {
      jobId: job.id,
      tjId: eventData.tjId,
    });
    return { MessageId: job.id };
  } catch (error) {
    logger.error("Error enqueuing video generation job via BullMQ:", error);
    throw error;
  }
}

export async function enqueueAutomationSourcePageTask(
  eventData: AutomationSourcePageProcessingEventData,
) {
  try {
    const { getQueue } = await import("./bullmq/queues.js");
    const { QUEUE_NAMES } = await import("./bullmq/types.js");
    const queue = await getQueue(QUEUE_NAMES.AUTOMATION_SOURCE_PROCESSING);
    const job = await queue.add(
      "automation-source-page",
      eventData,
      {
        jobId: `source-page-${eventData.sourceUploadId}-${eventData.pageNumber}`,
      },
    );
    logger.debug("Automation source page job enqueued via BullMQ", {
      jobId: job.id,
      sourceUploadId: eventData.sourceUploadId,
      pageNumber: eventData.pageNumber,
    });
    return { MessageId: job.id };
  } catch (error) {
    logger.error("Error enqueuing automation source page job via BullMQ:", error);
    throw error;
  }
}

export async function enqueueChapterDetectionTask(
  eventData: ChapterDetectionEventData,
) {
  try {
    const { getQueue } = await import("./bullmq/queues.js");
    const { QUEUE_NAMES } = await import("./bullmq/types.js");
    const queue = await getQueue(QUEUE_NAMES.CHAPTER_DETECTION);
    const job = await queue.add("chapter-detection", eventData, {
      jobId: `chapter-detect-${eventData.sourceUploadId}`,
    });
    logger.debug("Chapter detection job enqueued via BullMQ", {
      jobId: job.id,
      sourceUploadId: eventData.sourceUploadId,
    });
    return { MessageId: job.id };
  } catch (error) {
    logger.error("Error enqueuing chapter detection job via BullMQ:", error);
    throw error;
  }
}

export async function enqueueChapterScriptTask(
  eventData: ChapterScriptEventData,
) {
  try {
    const { getQueue } = await import("./bullmq/queues.js");
    const { QUEUE_NAMES } = await import("./bullmq/types.js");
    const queue = await getQueue(QUEUE_NAMES.CHAPTER_SCRIPT);
    const job = await queue.add("chapter-script", eventData, {
      jobId: `chapter-script-${eventData.sourceUploadId}-${eventData.chapterNumber}`,
    });
    logger.debug("Chapter script job enqueued via BullMQ", {
      jobId: job.id,
      sourceUploadId: eventData.sourceUploadId,
      chapterNumber: eventData.chapterNumber,
    });
    return { MessageId: job.id };
  } catch (error) {
    logger.error("Error enqueuing chapter script job via BullMQ:", error);
    throw error;
  }
}

export async function enqueueLibraryItemDeletionTask(
  eventData: LibraryItemDeletionEventData,
) {
  try {
    const { getQueue } = await import("./bullmq/queues.js");
    const { QUEUE_NAMES } = await import("./bullmq/types.js");
    const queue = await getQueue(QUEUE_NAMES.LIBRARY_ITEM_DELETION);
    const job = await queue.add("library-item-deletion", eventData, {
      jobId: `deletion-${eventData.brollId}-${Date.now()}`,
    });
    logger.debug("Library item deletion job enqueued via BullMQ", {
      jobId: job.id,
      brollId: eventData.brollId,
    });
    return { MessageId: job.id };
  } catch (error) {
    logger.error("Error enqueuing library item deletion job via BullMQ:", error);
    throw error;
  }
}

export async function enqueueLibraryImportTask(
  eventData: LibraryImportEventData,
) {
  try {
    const { getQueue } = await import("./bullmq/queues.js");
    const { QUEUE_NAMES } = await import("./bullmq/types.js");
    const queue = await getQueue(QUEUE_NAMES.LIBRARY_IMPORT);
    const job = await queue.add("library-import", eventData, {
      jobId: `library-import-${eventData.jobId}`,
      // The processor deletes the temp ZIP (local + MinIO) after every attempt,
      // success or failure, so a BullMQ-driven retry would find nothing to read.
      // A failed import is retried by the user re-uploading, not automatically.
      attempts: 1,
    });
    logger.debug("Library import job enqueued via BullMQ", {
      jobId: job.id,
      importJobId: eventData.jobId,
    });
    return { MessageId: job.id };
  } catch (error) {
    logger.error("Error enqueuing library import job via BullMQ:", error);
    throw error;
  }
}

export async function enqueueLibraryItemPreviewGeneratorTask(
  eventData: { brollId: string; userId: string; version: "1.0.0" },
) {
  try {
    const { getQueue } = await import("./bullmq/queues.js");
    const { QUEUE_NAMES } = await import("./bullmq/types.js");
    const queue = await getQueue(QUEUE_NAMES.LIBRARY_ITEM_MEDIA_GENERATION);

    const mediaEvent: LibraryItemMediaGenerationEventData = {
      brollId: eventData.brollId,
      userId: eventData.userId,
      taskType: "preview",
      version: "1.0.0",
    };

    const job = await queue.add(
      "media-generation",
      mediaEvent,
      {
        jobId: `preview-${eventData.brollId}-${Date.now()}`,
      },
    );
    logger.debug("Preview generation routed via BullMQ", {
      jobId: job.id,
      brollId: eventData.brollId,
    });
    return { MessageId: job.id };
  } catch (error) {
    logger.error("Error routing preview generation to BullMQ:", error);
    throw error;
  }
}

export async function enqueueLibraryItemHashGenerationTask(
  eventData: { brollId: string; userId: string; version: "1.0.0" },
) {
  try {
    const { getQueue } = await import("./bullmq/queues.js");
    const { QUEUE_NAMES } = await import("./bullmq/types.js");
    const queue = await getQueue(QUEUE_NAMES.LIBRARY_ITEM_MEDIA_GENERATION);

    const mediaEvent: LibraryItemMediaGenerationEventData = {
      brollId: eventData.brollId,
      userId: eventData.userId,
      taskType: "hash",
      version: "1.0.0",
    };

    const job = await queue.add(
      "media-generation",
      mediaEvent,
      {
        jobId: `hash-${eventData.brollId}-${Date.now()}`,
      },
    );
    logger.debug("Hash generation routed via BullMQ", {
      jobId: job.id,
      brollId: eventData.brollId,
    });
    return { MessageId: job.id };
  } catch (error) {
    logger.error("Error routing hash generation to BullMQ:", error);
    throw error;
  }
}

export async function enqueueFCPXMLExportTask(
  eventData: FCPXMLExportEventData,
) {
  try {
    const { getQueue } = await import("./bullmq/queues.js");
    const { QUEUE_NAMES } = await import("./bullmq/types.js");
    const queue = await getQueue(QUEUE_NAMES.FCPXML_EXPORT);
    const job = await queue.add("fcpxml-export", eventData, {
      jobId: `fcpxml-${eventData.exportJobId}`,
    });
    logger.debug("FCPXML export job enqueued via BullMQ", {
      jobId: job.id,
      exportJobId: eventData.exportJobId,
    });
    return { MessageId: job.id };
  } catch (error) {
    logger.error("Error enqueuing FCPXML export job via BullMQ:", error);
    throw error;
  }
}

export async function enqueueChatVideoFinalizationTask(
  eventData: ChatVideoFinalizationEventData,
) {
  try {
    const { getQueue } = await import("./bullmq/queues.js");
    const { QUEUE_NAMES } = await import("./bullmq/types.js");
    const queue = await getQueue(QUEUE_NAMES.CHAT_VIDEO_FINALIZATION);
    const job = await queue.add(
      "chat-video-finalization",
      eventData,
      {
        jobId: `chat-finalization-${eventData.tjId}`,
      },
    );
    logger.debug("Chat video finalization job enqueued via BullMQ", {
      jobId: job.id,
      tjId: eventData.tjId,
    });
    return { MessageId: job.id };
  } catch (error) {
    logger.error("Error enqueuing chat video finalization job via BullMQ:", error);
    throw error;
  }
}

export async function enqueueLibraryClusteringTask(
  eventData: LibraryClusteringEventData,
): Promise<{ MessageId: string; alreadyRunning: boolean }> {
  try {
    const { getQueue } = await import("./bullmq/queues.js");
    const { QUEUE_NAMES } = await import("./bullmq/types.js");
    const queue = await getQueue(QUEUE_NAMES.LIBRARY_CLUSTERING);

    // One clustering slot per library, keyed by a fixed jobId. BullMQ's add()
    // silently returns the *existing* job for a jobId that's already present —
    // including one that finished a moment ago — so a fixed jobId alone would
    // only ever cluster a library once, ever. Explicitly clearing a
    // completed/failed slot before re-adding is what makes it "one at a time"
    // (spamming while a run is active/waiting is a no-op) without permanently
    // blocking every future run.
    const jobId = `clustering-${eventData.libraryId}`;
    const existing = await queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === "completed" || state === "failed") {
        await existing.remove();
      } else {
        logger.debug("Library clustering job already in flight, not re-enqueuing", {
          jobId,
          state,
          libraryId: eventData.libraryId,
        });
        return { MessageId: existing.id!, alreadyRunning: true };
      }
    }

    const job = await queue.add("library-clustering", eventData, { jobId });
    logger.debug("Library clustering job enqueued via BullMQ", {
      jobId: job.id,
      libraryId: eventData.libraryId,
    });
    return { MessageId: job.id!, alreadyRunning: false };
  } catch (error) {
    logger.error("Error enqueuing library clustering job via BullMQ:", error);
    throw error;
  }
}
