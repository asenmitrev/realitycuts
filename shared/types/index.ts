export type { SyncPrerecordedResponse } from '@deepgram/sdk';
import { SyncPrerecordedResponse } from '@deepgram/sdk';
import { ChatCompletionMessageParam } from 'openai/resources';
import { FfprobeData } from 'fluent-ffmpeg';
import { entitlementMap } from '../config/pricingMap';
import { VideoCategorizationMetadata } from './video-categorization';

export type { Voice as ElevenLabsVoice } from '@elevenlabs/elevenlabs-js/api/types';
export * from './video-categorization';

export type Word = {
  type: string;
  start_time?: string | undefined;
  end_time?: string | undefined;
  wordIndex?: number;
  isVisible?: boolean;
};
export interface WordBase {
  _id?: string;
  word: string;
  start: number;
  end: number;
  confidence: number;
  wordIndex?: number;
  punctuated_word?: string;
  speaker?: number;
  speaker_confidence?: number;
}

export interface Source {
  url: string;
  metadata: VideoMetadata;
  thumbnail: string;
  audio?: string;
}

export interface WordBaseEdited extends WordBase {
  isVisible?: boolean;
  isParagraphEnd?: boolean;
}
export type WordWithAlternatives = Word & {
  alternatives: { confidence: string; content: string }[];
};

export type Sentence = {
  content: string;
  words: WordBaseEdited[];
  start: number | undefined;
  end: number | undefined;
};
export type Job = {
  results: {
    items: WordWithAlternatives[];
  };
};

export type TranscriptionLineJson = {
  _id?: string;
  timeStart?: number;
  timeEnd?: number;
  words: WordBase[];
  content: string;
  index: number;
};

export type HighlightSegment = {
  start: number;
  end: number;
};

export type EditedTranscript = SyncPrerecordedResponse & {
  results: {
    channels: {
      alternatives: {
        words: WordBaseEdited[];
      }[];
    }[];
  };
};

export type CaptionType = 'WORD_HIGHLIGHT' | 'WORD_APPEAR' | 'WORD_BACKGROUND';
export type CaptionFontFamily =
  | 'Montserrat-Bold'
  | 'Roboto Medium'
  | 'Poppins Medium'
  | 'Fira Sans Condensed ExtraBold Italic'
  | 'Lobster Regular';
export type CaptionSettings = {
  type: CaptionType;
  fontFamily: CaptionFontFamily;
  fontFamilyCss?: string;
  isUppercase: boolean;
  primaryColor: string;
  outlineColor: string;
  backgroundColor?: string;
  numberOfLines?: number;
  fontSize?: number;
  verticalFontSize?: number;
  letterSpacing?: number;
  activeWordFontSize?: number;
  verticalActiveWordFontSize?: number;
  userId?: string;
  maxCharactersPerLine?: number;
  name?: string;
  shadow?: 0 | 1 | 2 | 3 | 4;
  highlightedWordColor: string;
  isDefault?: boolean;
  marginV: number;
  position?: 'top' | 'center' | 'bottom';
  outlineWidth: number;
  // Mongo props
  __v?: number;
  _id?: string;
  createdAt?: string;
  updatedAt?: string;
};
export type OrientationType = 'HORIZONTAL' | 'VERTICAL' | 'BOTH';
export type ExportType = 'CAPTIONS' | 'VIDEO_CAPTIONS' | 'VIDEO' | 'FCPXML';
export type Stream = {
  index: number;
  codec_name: string | undefined;
  codec_long_name: string | undefined;
  profile: string | undefined;
  codec_type: string | undefined;
  codec_tag_string: string | undefined;
  codec_tag: string | undefined;
  width: number | undefined;
  height: number | undefined;
  coded_width: number | undefined;
  coded_height: number | undefined;
  closed_captions: number | undefined;
  film_grain: number | undefined;
  has_b_frames: number | undefined;
  sample_aspect_ratio: string | undefined;
  display_aspect_ratio: string | undefined;
  pix_fmt: string | undefined;
  level: number | undefined;
  color_range: string | undefined;
  color_space: string | undefined;
  color_transfer: string | undefined;
  color_primaries: string | undefined;
  chroma_location: string | undefined;
  field_order: string | undefined;
  refs: number | undefined;
  is_avc: string | undefined;
  nal_length_size: number | undefined;
  id: string | undefined;
  r_frame_rate: string | undefined;
  avg_frame_rate: string | undefined;
  time_base: string | undefined;
  start_pts: number | undefined;
  start_time: number | undefined;
  duration_ts: number | undefined;
  duration: number | undefined;
  bit_rate: number | undefined;
  max_bit_rate: string | undefined;
  bits_per_raw_sample: number | undefined;
  nb_frames: number | undefined;
  nb_read_frames: string | undefined;
  nb_read_packets: string | undefined;
  extradata_size: number | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tags: [any];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  disposition: [any];
};
export type VideoMetadata = {
  streams: FfprobeData['streams'];
  format: {
    filename: string | undefined;
    nb_streams: number | undefined;
    nb_programs: number | undefined;
    format_name: string | undefined;
    format_long_name: string | undefined;
    start_time: number | undefined;
    duration: number | undefined;
    size: number | undefined;
    bit_rate: number | undefined;
    probe_score: number | undefined;
    tags?: {
      major_brand: string | undefined;
      minor_version: string | undefined;
      compatible_brands: string | undefined;
      comment: string | undefined;
      aigc_info: string | undefined;
      encoder: string | undefined;
    };
  };
};

export interface TranscriptionJob {
  _id?: string;
  userId: string;
  videoUrl: string;
  thumbnailUrl: string;
  isAiThumbnail?: boolean;
  brollDuration?: number;
  includeMusic: boolean;
  script: string;
  audioUrl: string;
  pinecone: boolean;
  title?: string;
  deepgramResults?: SyncPrerecordedResponse;
  transcript?: WordBaseEdited[];
  batchName: string;
  filename: string;
  isAudioOnly?: boolean;
  metadata?: VideoMetadata;
  guidance: string;
  isDeleted: boolean;
  jobType: 'B_ROLL' | 'HIGHLIGHT' | 'HIGHLIGHT_B_ROLL' | 'SCRIPT' | 'AUDIO' | 'PROMPT';
  status: 'VIDEO_RECEIVED' | 'CREATED' | 'QUEUED' | 'TRANSCRIBED' | 'COMPLETED' | 'FAILED' | 'INSUFFICIENT_FOOTAGE';
}
export type UserRole = 'editor' | 'admin' | 'user' | 'pankeik';

export interface IUserProfile {
  _id: string;
  firebaseId: string;
  firstName: string;
  lastName: string;
  projects: string[];
  isAdmin: boolean; // DO NOT USE, ALEX ONLY
  emailPreferences: {
    email: boolean;
    sms: boolean;
  };
  entitlements?: {
    id: string;
    name: keyof typeof entitlementMap;
  }[];
  usage?: {
    libraryMinutesSpent: number;
    ttsMinutesSpent: number;
    gbStorage: number;
    chatCreditsSpent: number;
  };
  lastLimitReset?: Date;
  excludeFromAnalytics?: boolean;
  role: UserRole;
  isAnonymous?: boolean;
  youtubeChannels?: IYoutubeChannel[];
}

export interface IYoutubeChannel {
  channelId: string;
  channelTitle: string;
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: number | null;
}
export type LibraryTaskSettings = {
  files: {
    fileId: string;
  }[];
};

export interface ILibrary {
  _id?: string;
  userId: string;
  title: string;
  description: string;
  processedFiles: {
    link: string;
    prompt: string;
    progress: number;
    status: 'NEW' | 'PROCESSING' | 'PROCESSED' | 'FAILED';
  }[];
  progress: number;
  asyncProgress: Record<string, number>;
  tags: string[];
  apifyRunId: string;
  isPublic: boolean;
  status: 'NEW' | 'QUEUED' | 'PROCESSING' | 'PROCESSED' | 'REPROCESSING' | 'FAILED' | 'DELETED' | 'TAGGING';
  processingStatus:
  | 'YOUTUBE_DOWNLOADING'
  | 'YOUTUBE_DOWNLOADING_FAILED'
  | 'SPLITTING_STARTED'
  | 'SPLITTING_IN_PROGRESS'
  | 'SUCCESS'
  | 'FAILED'
  | 'REPROCESSING';
  // Clustering metadata
  clusteringMetadata?: ClusteringMetadata;
  // One-shot pipeline: set before library processing starts; triggers video generation on completion
  pendingOneShotJob?: {
    prompt: string;
    tjId: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export type IPopulatedLibrary = Omit<ILibrary, 'processedFiles'> & {
  processedFiles: (Omit<ILibrary['processedFiles'][number], 'link'> & { link: ILibraryUpload })[];
};

export type UploadType = 'highlight' | 'video' | 'script' | 'prompt' | 'audio';

export type NotificationType =
  | 'EXPORT_COMPLETE'
  | 'VIDEO_COMPLETE'
  | 'LIBRARY_POPULATED'
  | 'AUTOMATION_FAILED';
export type NotificationIdType = 'EXPORT' | 'VIDEO' | 'LIBRARY' | 'EXTERNAL';

export type INotification = {
  _id?: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  links: { text?: string; url?: string; linkType: NotificationIdType; docId: string }[];
};
export interface IUserProfileWithMethods extends IUserProfile {
  getTTSMinutesRemaining: () => number;
  getLibraryMinutesRemaining: () => number;
  getStorageGbRemaining: () => Promise<number>;
  getChatCreditsRemaining: () => number;
  getAutomationLimits: () => { daily: number; weekly: number };
  canCreateAutomation: (existingCounts: { daily: number; weekly: number }, scheduleType: 'DAILY' | 'WEEKLY') => boolean;
  getRemainingAutomationSlots: (existingCounts: { daily: number; weekly: number }) => { daily: number; weekly: number };
}
export interface IHighlightInstance {
  _id?: string;
  startIndex: number;
  highlightData?: string;
  isAcceptedForEditing: boolean;
  score: number;
  source?: Source;
  title?: string;
  endIndex: number;
  editedWordsList: WordBaseEdited[];
  previews?: string[];
  verticalPreviews?: string[];
}

export interface IHighlightData {
  _id?: string;
  title: string;
  transcriptionJob: string;
  source: Source;
  userId: string;
  messages: ChatCompletionMessageParam[];
  speakerMap: Record<number, string>;
  highlights: string[];
}
export type Line = {
  content: WordBase[];
  start: number;
  end: number;
};

export interface Alternative {
  _id?: string;
  videoId?: string;
  link: string;
  preview: string;
  title: string;
  duration?: number;
  thumbnailUrl: string;
  dbId?: string;
  offsetStart: number;
  isVisible?: boolean;
  score: number;
  isFocused?: boolean;
  framing?: VideoCategorizationMetadata['framing'];
  complexity?: VideoCategorizationMetadata['complexity'];
  cameraAngle?: VideoCategorizationMetadata['cameraAngle'];
  perspective?: VideoCategorizationMetadata['perspective'];
  depthOfField?: VideoCategorizationMetadata['depthOfField'];
  arollBroll?: VideoCategorizationMetadata['arollBroll'];
  focusPosition?: VideoCategorizationMetadata['focusPosition'];
  leftPosition?: number;
  topPosition?: number;
  perceptualHash?: string;
  type: 'pinecone' | 'pexels';
  id: number;
  isVertical?: boolean;
  videoEmbedding?: number[];
  brollType?: 'VIDEO' | 'IMAGE' | 'AI_PHOTO' | 'SVG_INFOGRAPHIC';
}

export type SegmentAlternative = Alternative;

export interface Segment {
  _id?: string;
  alternatives: SegmentAlternative[];
  timeStart: number;
  timeEnd: number;
  segmentId?: string;
  keywords: string;
}

export interface Audio {
  id: number;
  preview: string;
  title: string;
  audioType: string;
  thumbnailUrl: string;
  waveformUrl: string;
  duration: number;
  bpm: number;
}

export interface IVideoAIData {
  _id?: string;
  title?: string;
  segments: Segment[];
  formattedTranscript: string;
  transcriptionJob: string;
  source?: Source;
  highlightId?: string;
  highlightInstanceId?: string;
  highlightSegments?: HighlightSegment[];
  voiceOver: string;
  audioEnabled: boolean;
  croppedInfo?: RecroppedVideoFrame[];
  audioIndex: number;
  editedWordsList: WordBaseEdited[];
  audioVolume: number;
  description?: string;
  audio: Audio[];
  userId: string;
  captions?: CaptionSettings;
  publicLibraryIds?: string[];
  privateLibraryIds?: string[];
}

export type IVideoAIDataWithTranscriptionJob = Omit<IVideoAIData, 'transcriptionJob'> & {
  transcriptionJob: TranscriptionJob;
};

export interface ICutterJob {
  inputPath: string;
  highlightId: string;
  highlightInstanceId: string;
  isVertical: boolean;
  userId: string;
  eventId: string;
  segments: HighlightSegment[];
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETE' | 'FAILED';
}

export type RecroppedVideoFrame = {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  frameStart: number;
  frameEnd: number;
  timeStart: number;
  timeEnd: number;
};

export type EXPORT_JOB_STATUS =
  | 'PROCESSING'
  | 'UPLOADING'
  | 'COMPLETED'
  | 'FAILED'
  | 'IN_REVIEW'
  | 'QUEUED';
export interface ExportJob {
  _id: string;
  userId: string;
  videoDataId: string;
  videoUrl: string;
  tiktokVideoUrl?: string;
  isWatermarked?: boolean;
  extraVideoUrl: string;
  isDeleted: boolean;
  exportType: ExportType;
  orientationType: OrientationType;
  status: EXPORT_JOB_STATUS;
  createdAt?: string;
  updatedAt?: string;
  brandWatermarkUploadId?: string;
  brandWatermarkPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  generateThumbnail?: boolean;
  thumbnailUrl?: string;
}

export type PineconeVideoMetadata = {
  title: string;
  duration: number;
  thumbnailUrl: string;
  thumbnailUrl2?: string;
  userId: string;
  libraryId?: string;
  url?: string;
  tag?: string;
  namespace?: string;
  originalYoutubeUrl: string;
  dbId?: string;
  isVertical?: boolean;
  // METADATA
  framing?: VideoCategorizationMetadata['framing'];
  cameraAngle?: VideoCategorizationMetadata['cameraAngle'];
  perspective?: VideoCategorizationMetadata['perspective'];
  depthOfField?: VideoCategorizationMetadata['depthOfField'];
  complexity?: VideoCategorizationMetadata['complexity'];
  arollBroll?: VideoCategorizationMetadata['arollBroll'];
  arollBrollHeuristic?: VideoCategorizationMetadata['arollBroll'];
  focusPosition?: VideoCategorizationMetadata['focusPosition'];
};

export type FaceDetectionData = {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
};

export type FaceDetectionFrame = {
  faceCount: number;
  faces: FaceDetectionData[];
};

export type FaceDetectionResults = {
  frame05s: FaceDetectionFrame;
  frame25s: FaceDetectionFrame;
};

export type ClusterStats = {
  clusterId: number;
  videoCount: number;
  keywords: string[];
  sampleVideoIds: string[];
};

export type ClusteringMetadata = {
  totalClusters: number;
  clusteringVersion: number;
  clusteringDate: Date | null;
  clusterStats: ClusterStats[];
  totalClusteredVideos: number;
  noiseVideos: number;
};

export type IBrollFootageMetadata = {
  _id?: string;
  url: string;
  hasVideoEmbeddings?: boolean;
  isDeleted?: boolean;
  isPublic: boolean;
  preview?: string;
  status?: 'NEW' | 'PROCESSING' | 'PROCESSED' | 'FAILED';
  brollType?: 'IMAGE' | 'VIDEO' | 'AI_PHOTO' | 'SVG_INFOGRAPHIC';
  videoEmbedding?: number[];
  thumbnailUrl: string;
  thumbnailUrl2?: string;
  imageUrl?: string;
  perceptualHash?: string;
  hasFaceDetection?: boolean;
  videoDimensions?: {
    width: number;
    height: number;
    aspect_ratio: number;
    orientation: string;
  };
  videoWidth?: number;
  faceDetectionResults?: FaceDetectionResults;
  // Clustering fields
  clusterId?: number | null;
  clusterVersion?: number | null;
  // Background motion analysis fields
  hasBackgroundMotionAnalysis?: boolean;
  backgroundMotionScore?: number | null; // 0-100, where 0 = static, 100 = high motion
  // Array of mouth movement scores, one per detected face (0-100)
  mouthMovementScores?: number[];
  // Maximum mouth movement score across all faces (0-100, null if no faces)
  maxMouthMovementScore?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
} & Omit<PineconeVideoMetadata, 'dbId'>;

export type TTSVoiceType =
  | 'alloy'
  | 'echo'
  | 'fable'
  | 'onyx'
  | 'nova'
  | 'shimmer'
  | 'ash'
  | 'ballad'
  | 'coral'
  | 'sage'
  | 'verse'
  | string;

export type ILibraryUpload = {
  _id?: string;
  libraryId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  originalName: string;
  s3Key: string;
  s3Bucket: string;
  url: string;
  uploadStatus: 'PENDING' | 'UPLOADING' | 'COMPLETED' | 'FAILED';
  errorMessage?: string;
  metadata?: any;
  duration: number;
  createdAt?: Date;
  updatedAt?: Date;
};
export type IS3Upload = {
  fileName: string;
  fileSize: number;
  mimeType: string;
  userId: string;
  originalName: string;
  expires: Date;
  s3Key: string;
  s3Bucket: string;
  url: string;
  uploadStatus: 'UPLOADING' | 'COMPLETED' | 'FAILED' | 'DELETED';
  duration?: number;
  createdAt?: Date;
  updatedAt?: Date;
};

export type ErrorWithMessage = {
  name: string;
  message: string;
  errors: undefined | [];
};

export type SQSTaskConfig =
  | {
    type: 'LIBRARY_PROCESSOR';
    payload: {
      libraryId: string;
      settings: LibraryTaskSettings;
    };
    dedupeId: string;
  }
  | {
    type: 'LIBRARY_PROCESSOR';
    payload: {
      libraryId: string;
      settingsId: string;
      version: '2.0.0';
    };
    dedupeId: string;
  }
  | {
    type: 'EXPORTER';
    payload: {
      exportJobId: string;
    };
    dedupeId: string;
  };
