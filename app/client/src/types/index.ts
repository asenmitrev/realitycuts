import type {
  IHighlightData as RawHighlightData,
  IHighlightInstance as RawHighlightInstance,
  Sentence,
  IVideoAIData,
  TranscriptionJob as ITranscriptionJob,
  WordBase,
  ILibrary as Library,
  WordBaseEdited,
  HighlightSegment,
  TTSVoiceType,
  Segment,
  IS3Upload,
  VideoCategorizationMetadata,
  CaptionSettings,
  Audio
} from 'shared/types';
export type Tag = { tag: string; libraryId: string | null; videoCount: number; screenshots: string[] };

export * from 'shared/types';

export type ILibrary = Library & {
  _id: string;
  totalProgress?: number;
};

export type IPopulatedLibrary = Omit<ILibrary, 'processedFiles'> & {
  processedFiles: {
    _id: string;
    status: 'NEW' | 'QUEUED' | 'PROCESSING' | 'PROCESSED' | 'REPROCESSING' | 'FAILED' | 'DELETED';
    link: IS3Upload;
    progress: number;
  }[];
};
export interface UploadFormData {
  title: string;
  guidance: string;
  systemPrompt: string;
  includeMusic: boolean;
  pinecone: boolean;
  pexels: boolean;
  brollDuration: number;
  script?: string;
  totalProgress?: number;
  voiceType?: TTSVoiceType;
  useVideoEmbeddings: boolean;
  size?: '1080p' | '1080x1920';
  fileLinks?: string;
  client?: string;
  libraries: (ILibrary & { isSelected: boolean; videoCount?: number })[];
  selectedTags: Tag[];
  isAllPublicLibrariesSelected: boolean;
  orientation?: 'horizontal' | 'vertical';
}
export type IHighlightInstance = Omit<RawHighlightInstance, '_id'> & {
  _id: string;
};

export type IHighlightData = Omit<RawHighlightData, 'highlights'> & {
  _id: string;
  highlights: {
    _id: string;
    isAcceptedForEditing: boolean;
    score?: number;
    title?: string;
  }[];
};

export type VideoObject = {
  url: string;
  timeStart: number;
  timeEnd: number;
  offsetStart: number;
  altId?: string;
  duration: number;
  segmentId?: string;
  isVisible: boolean;
  element?: HTMLVideoElement;
  imageElement?: HTMLImageElement;
  keywords: string;
  type: 'pinecone' | 'pexels';
  score: number;
  originalTimeStart?: number;
  originalTimeEnd?: number;
  dbId?: string; // The id of the broll pinecone metadata in the db
  id: number;
  thumbnail: string;
  leftPosition: number;
  topPosition: number;
  isVertical: boolean;
  videoId?: string;
  link: string;
  isFocused: boolean;
  title: string;
  brollType?: 'VIDEO' | 'IMAGE' | 'AI_PHOTO' | 'SVG_INFOGRAPHIC';
};

export enum PLAYBACK_STATE {
  PLAYING,
  PAUSED,
  ENDED
}

export type PlaybackSource = {
  url: string;
  element?: HTMLMediaElement;
};

export function isVideoSource(
  source: PlaybackSource
): source is PlaybackSource & { element: HTMLVideoElement } {
  return source.element instanceof HTMLVideoElement;
}

export type VideoAlternative = {
  preview: string;
  title: string;
  thumbnailUrl: string;
  link: string;
  type: 'pinecone' | 'pexels';
  leftPosition?: number;
  topPosition?: number;
  videoId?: string;
  id: number;
  offsetStart: number;
  isVertical?: boolean;
  score: number;
  duration: number;
  isVisible?: boolean;
  isFocused?: boolean;
  framing?: VideoCategorizationMetadata['framing'];
  cameraAngle?: VideoCategorizationMetadata['cameraAngle'];
  perspective?: VideoCategorizationMetadata['perspective'];
  depthOfField?: VideoCategorizationMetadata['depthOfField'];
  complexity?: VideoCategorizationMetadata['complexity'];
  arollBroll?: VideoCategorizationMetadata['arollBroll'];
  focusPosition?: VideoCategorizationMetadata['focusPosition'];
  _id?: string;
  dbId?: string;
  hasFaceDetection?: boolean;
  faceDetectionResults?: {
    faceCount: number;
    faces: {
      boundingBox: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
      confidence: number;
    }[];
  };
  brollType?: 'VIDEO' | 'IMAGE' | 'AI_PHOTO' | 'SVG_INFOGRAPHIC';
};

export type VideoSegment = {
  alternatives: VideoAlternative[];
  timeStart: number;
  timeEnd: number;
  keywords: string;
  _id?: string;
};

export type AudioData = {
  id: number;
  preview: string;
  title: string;
  audioType: string;
  thumbnailUrl: string;
  waveformUrl: string;
  duration: number;
  bpm: number;
};
export type VideoAIData = IVideoAIData & {
  _id: string;
  highlightInstanceId?: IHighlightInstance;
  transcriptionJob: ITranscriptionJob;
};

export type PlaylistState = {
  videoMap: VideoObject[][];
  playlist: VideoObject[];
  altMap: number[];
  needsRedraw: boolean;
  isDirty: boolean;
};
export type VideoHighlightShimState = {
  transcript: WordBase[];
  segments: HighlightSegment[];
  duration: number;
};
export type CaptionsState = {
  transcript: WordBase[];
};
export type CaptionsReducerAction = {
  type: 'EDIT_WORD';
  payload: {
    word: WordBase;
  };
};
export type UPLOAD_PROGRESS_STATUS =
  | 'VIDEO_RECEIVED'
  | 'CREATED'
  | 'QUEUED'
  | 'TRANSCRIBED'
  | 'COMPLETED'
  | 'FAILED'
  | 'INSUFFICIENT_FOOTAGE';
export type JOB_TYPE = 'B_ROLL' | 'HIGHLIGHT';

export type UploadProgress = {
  _id: string;
  title?: string;
  userId: string;
  videoUrl: string;
  thumbnailUrl: string;
  audiUrl: string;
  status: UPLOAD_PROGRESS_STATUS;
  jobType: JOB_TYPE;
};
export type OnPlayCallback = (currentTime: number, currentAbsoluteTime: number, currentBroll?: VideoObject) => void;

export type Message = {
  _id: string;
  message: string;
  eventId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  progress?: number;
  isError?: boolean;
};

export interface HighlightEditorState {
  sentences: Array<Sentence & { isVisible: boolean; index: number }>;
  startIndex: number;
  endIndex: number;
  isDirty: boolean;
}

export type HighlightEditorAction =
  | {
    type: 'SET_DIRTY';
    payload: {
      isDirty: boolean;
    };
  }
  | {
    type: 'REPLACE_WORDS';
    payload: {
      startTime: number;
      endTime: number;
      transcript: WordBaseEdited[];
      words: WordBaseEdited[];
    };
  }
  | {
    type: 'CHANGE_WORD_SPELLING';
    payload: {
      wordIndex: number;
      word: string;
    };
  }
  | {
    type: 'CHANGE_WORD_TIMING';
    payload: {
      wordIndex: number;
      start: number;
      end: number;
    };
  }
  | {
    type: 'RESET';
    payload: {
      transcript: WordBaseEdited[];
    };
  }
  | {
    type: 'SET_SENTENCE_VISIBILITY';
    payload: {
      sentence: Sentence;
      isVisible: boolean;
    };
  }
  | {
    type: 'SET_WORD_VISIBILITY';
    payload: {
      sentence: Sentence;
      isVisible: boolean;
      word: WordBase;
    };
  }
  | {
    type: 'CHANGE_WORDS_VISIBILITY';
    payload: {
      wordIds: number[];
      isVisible: boolean;
    };
  }
  | {
    type: 'REMOVE_FILLER_WORDS';
    payload: {
      wordIds: number[];
    };
  };

export type VideoPlayerAction =
  | {
    type: 'SET_IS_DIRTY';
    payload: {
      isDirty: boolean;
    };
  }
  | {
    type: 'HYDRATE';
    payload: {
      data: VideoAIData;
    };
  }
  | {
    type: 'REPLACE_SEGMENTS';
    payload: {
      segments: Segment[];
      timeStart: number;
      timeEnd: number;
    };
  }
  | {
    type: 'TOGGLE_CURRENT_ALT_ENABLED';
    payload: {
      currentTime: number;
    };
  }
  | {
    type: 'TOGGLE_CURRENT_ALT_VARIATION';
    payload: {
      video: VideoObject;
    };
  }
  | {
    type: 'CHANGE_VIDEO_TIME';
    payload: {
      timeStart: number;
      timeEnd: number;
      offsetStart: number;
      video: VideoObject;
    };
  }
  | {
    type: 'ADD_ALTS';
    payload: {
      keywords: string;
      alternatives: VideoAlternative[];
      timeStart: number;
      timeEnd: number;
    };
  }
  | {
    type: 'REMOVE_SEGMENT';
    payload: {
      video: VideoObject;
    };
  }
  | {
    type: 'REPLACE_ALTS';
    payload: {
      video: VideoObject;
      keywords: string;
      alternatives: VideoAlternative[];
    };
  }
  | {
    type: 'CHANGE_VIDEO_POSITION';
    payload: {
      video: VideoObject;
      leftPosition: number;
      topPosition: number;
    };
  }
  | {
    type: 'TOGGLE_VIDEO_VISIBLE';
    payload: {
      video: VideoObject;
    };
  }
  | {
    type: 'SET_AUDIO_ENABLED';
    payload: {
      audioEnabled: boolean;
    };
  }
  | {
    type: 'SET_AUDIO_INDEX';
    payload: {
      audioIndex: number;
    };
  }
  | {
    type: 'SET_AUDIO';
    payload: {
      audio: Audio[];
    };
  }
  | {
    type: 'SET_AUDIO_VOLUME';
    payload: {
      volume: number;
    };
  };
export type AutomationSourceStatus = 'idle' | 'processing' | 'completed' | 'failed';

export interface IAutomationSource {
  uploadId?: string;
  fileUrl?: string;
  fileName?: string;
  status?: AutomationSourceStatus;
  totalPages?: number;
  processedPages?: number;
  scriptCount?: number;
  error?: string;
  isDeleted?: boolean;
  deletedAt?: string;
}

export interface IAutomationScript {
  _id: string;
  automationConfigId: string;
  userId: string;
  topic: string;
  script: string;
  sourceUploadId: string;
  sourcePageNumber: number;
  status: 'available' | 'used' | 'deleted';
  usedAt?: string | null;
  deletedAt?: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationConfigFormData {
  isEnabled: boolean;
  isAllPublicLibrariesSelected: boolean;
  schedule: {
    type: 'DAILY' | 'WEEKLY';
    dailyTimes?: {
      hour: number;
      minute: number;
      label?: string;
    }[];
    weeklyDays?: number[]; // 0-6 (Sunday-Saturday)
    weeklyTime?: {
      hour: number;
      minute: number;
    };
  };
  contentSettings: {
    theme: string;
    voiceId?: string;
    isVoicePremium?: boolean;
    privateLibraryIds?: string[];
    publicLibraryIds?: string[];
    pexels?: boolean;
    isPublic?: boolean;
    captionPreset?: CaptionSettings;
    brandWatermarkUploadId?: string;
    brandWatermarkPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
    hashtags?: string;
    includeMusic?: boolean;
    musicPrompt?: string;
    orientation?: 'horizontal' | 'vertical';
    generateThumbnail?: boolean;
    sources?: IAutomationSource[];
  };
  pexels: boolean;
  libraries: (ILibrary & { isSelected: boolean; videoCount?: number })[];
  selectedTags: Tag[];
}

export interface IAutomationConfig {
  _id: string;
  environment: 'prod' | 'uat' | 'test';
  userId: string;
  isEnabled: boolean;
  schedule: {
    type: 'DAILY' | 'WEEKLY';
    dailyTimes?: {
      hour: number;
      minute: number;
      label?: string;
    }[];
    weeklyDays?: number[]; // 0-6 (Sunday-Saturday)
    weeklyTime?: {
      hour: number;
      minute: number;
    };
  };
  contentSettings: {
    theme: string;
    voiceId?: string;
    isVoicePremium?: boolean;
    privateLibraryIds?: string[];
    publicLibraryIds?: string[];
    allPublicLibrariesSelected?: boolean;
    pexels?: boolean;
    isPublic?: boolean;
    captionPreset?: CaptionSettings;
    brandWatermarkUploadId?: string;
    brandWatermarkPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
    hashtags?: string;
    includeMusic?: boolean;
    musicPrompt?: string;
    orientation?: 'horizontal' | 'vertical';
    generateThumbnail?: boolean;
    sources?: IAutomationSource[];
  };
  lastProcessed?: Date;
  status: 'ACTIVE' | 'PAUSED';
  createdAt: Date;
  updatedAt: Date;
}
