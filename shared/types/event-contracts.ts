import type { CaptionSettings, ExportJob, UploadType } from "./index";

/** Unified library item processing payload — covers both video embedding and classification. */
export type LibraryItemProcessingEventData = {
	brollId: string;
	userId: string;
	prompt?: string;
	ytVideoDescription?: string;
	version: "1.0.0";
};

export type LibraryItemClassificationEventData =
	| {
			videoUrl: string;
			image1Url: string;
			image2Url: string;
			duration: number;
			prompt: string;
			tag?: string;
			userId: string;
			libraryId: string;
			videoDescription: string;
			youtubeLink: string;
			isVertical: boolean;
			version: "1.0.0";
	  }
	| {
			brollId: string;
			prompt: string;
			ytVideoDescription: string;
			userId: string;
			version: "2.0.0";
	  };

export type LibraryItemDeletionEventData = {
	brollId: string;
	userId: string;
	version: "1.0.0";
};

export type ExportJobEventData = {
	exportJobId: string;
	version: "1.0.0";
};

export type FCPXMLExportEventData = {
	exportJobId: string;
	version: "1.0.0";
};

export type LibraryItemVideoEmbeddingEventData = {
	brollId: string;
	userId: string;
	prompt?: string;
	ytVideoDescription?: string;
	version: "1.0.0";
};

export type LibraryItemThumbnailGenerationEventData = {
	brollId: string;
	userId: string;
	prompt: string;
	videoDescription: string;
	version: "1.0.0";
};

export type LibraryItemPreviewGenerationEventData = {
	brollId: string;
	userId: string;
	version: "1.0.0";
};

export type LibraryItemMetadataGenerationEventData = {
	brollId: string;
	image1Url: string;
	image2Url: string;
	version: "1.0.0";
};

export type LibraryItemImageToVideoEventData = {
	brollId: string;
	userId: string;
	version: "1.0.0";
};

export type LibraryItemHashGenerationEventData = {
	brollId: string;
	userId: string;
	version: "1.0.0";
};

/**
 * Unified media generation event — replaces three separate Lambda events
 * (thumbnail, preview, hash) with a single BullMQ queue.
 * The `taskType` field determines which processing branch to execute.
 */
export type LibraryItemMediaGenerationEventData = {
	brollId: string;
	userId: string;
	taskType: "thumbnail" | "preview" | "hash";
	/** Required for thumbnail task — prompt used for downstream classification. */
	prompt?: string;
	/** Required for thumbnail task — video description used for downstream classification. */
	videoDescription?: string;
	version: "1.0.0";
};

export type LibraryItemComplexityArollBrollUpdateEventData = {
	brollId: string;
	userId: string;
	version: "1.0.0";
};

export type VideoGenerationEventData =
	| VideoGenerationEventDataV1
	| VideoGenerationEventDataV2
	| VideoGenerationEventDataV3
	| VideoGenerationEventDataV4;

export type VideoGenerationEventDataV1 = {
	guidance: string;
	userId: string;
	systemPrompt?: string;
	videoUrl: string;
	privateLibraryIds?: string[];
	publicLibraryIds?: string[];
	selectedTags?: string[];
	language?: string;
	useVideoEmbeddings: boolean;
	libraries?: {
		pexels: boolean;
	};
	title: string;
	isTalkingHead: boolean;
	includeMusic: boolean;
	tjId: string;
	totalDuration?: number;
	brollDuration: number;
	version: "1.0.0";
	isAllPublicLibrariesSelected?: boolean;
};

export type VideoGenerationEventDataV2 = {
	guidance: string;
	userId: string;
	systemPrompt?: string;
	privateLibraryIds?: string[];
	publicLibraryIds?: string[];
	captions?: CaptionSettings;
	script?: string;
	selectedTags?: string[];
	fileUrl?: string;
	isVoicePremium: boolean;
	voiceType: string;
	size: "1080p" | "1080x1920";
	language?: string;
	uploadType: UploadType;
	useVideoEmbeddings: boolean;
	libraries?: {
		pexels: boolean;
	};
	title: string;
	isTalkingHead: boolean;
	includeMusic: boolean;
	musicPrompt?: string;
	tjId: string;
	brollDuration: number;
	version: "2.0.0";
	isAllPublicLibrariesSelected?: boolean;
	exportConfig?: Partial<ExportJob>;
};

export type VideoGenerationEventDataV3 = {
	guidance: string;
	userId: string;
	systemPrompt?: string;
	privateLibraryIds?: string[];
	publicLibraryIds?: string[];
	captions?: CaptionSettings;
	script?: string;
	selectedTags?: string[];
	fileUrl?: string;
	isVoicePremium: boolean;
	voiceType: string;
	size: "1080p" | "1080x1920";
	language?: string;
	uploadType: UploadType;
	orientation?: "HORIZONTAL" | "VERTICAL";
	libraries?: {
		pexels: boolean;
	};
	title: string;
	isTalkingHead: boolean;
	includeMusic: boolean;
	musicPrompt?: string;
	skipScriptGeneration?: boolean;
	historyKey?: string;
	tjId: string;
	brollDuration: number;
	version: "3.0.0";
	isAllPublicLibrariesSelected?: boolean;
	exportConfig?: Partial<ExportJob>;
	linkedChannelIds?: string[]; // For viral video tracking integration
	isOneShotJob?: boolean;
};

export type VideoGenerationEventDataV4 = {
	guidance: string;
	userId: string;
	privateLibraryIds?: string[];
	publicLibraryIds?: string[];
	captions?: CaptionSettings;
	script?: string;
	fileUrl?: string;
	isVoicePremium: boolean;
	voiceType: string;
	size: "1080p" | "1080x1920";
	language?: string;
	uploadType: UploadType;
	libraries?: {
		pexels: boolean;
	};
	title: string;
	isTalkingHead: boolean;
	includeMusic: boolean;
	skipScriptGeneration?: boolean;
	historyKey?: string;
	tjId: string;
	version: "4.0.0";
	isAllPublicLibrariesSelected?: boolean;
	exportConfig?: Partial<ExportJob>;
	linkedChannelIds?: string[]; // For viral video tracking integration
};

export type ChatVideoFinalizationEventData = {
	videoAIDataId: string;
	tjId: string;
	userId: string;
	voiceOverUrl: string;
	title: string;
	version: "1.0.0";
};

/** One SQS message per PDF page for automation source processing */
export type AutomationSourcePageProcessingEventData = {
	version: "1.0.0";
	automationConfigId: string;
	sourceUploadId: string;
	pageNumber: number;
	pageText: string;
	theme: string;
	userId: string;
	totalPages: number;
};

/** One SQS message per PDF source for chapter detection (horizontal automations). */
export type ChapterDetectionEventData = {
	version: "1.0.0";
	automationConfigId: string;
	sourceUploadId: string;
	pageTextsS3Key: string;
	theme: string;
	userId: string;
	totalPages: number;
};

/** One SQS message per detected chapter for script creation. */
export type ChapterScriptEventData = {
	version: "1.0.0";
	automationConfigId: string;
	sourceUploadId: string;
	chapterNumber: number;
	chapterTitle: string;
	chapterText?: string;
	chapterTextS3Key?: string;
	startPage: number;
	endPage: number;
	theme: string;
	userId: string;
	totalChapters: number;
};
