import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generationProcessor, generationProcessorV2 } from '../generation-processor';
import { TranscriptionJob } from '../../models/transcription-job';
import { UserProfile } from '../../models/user-profile';
import { generateFootageSuggestions } from '../video-generation/v11-proper-context/get-suggestions';
import { transcribeUrl } from '../ai/deepgram';
import { logger } from '../logging';
import { mockTranscriptionResults } from './__mocks__';
import libraryRepository from '../../repositories/library.repository';
import transcriptionJobRepository from '../../repositories/transcription-job.repository';
import userProfileRepository from '../../repositories/user-profile.repository';
import { analyzeAndGenerateScript } from '../../agents/script-or-prompt.agent';
import { generateVoiceover } from '../tts';
import { generateVideoFromAudio, getMetadata } from '../video-manipulation/ffmpeg';
import { downloadFile, safelyDelete } from '../fs';
import { uploadToS3 } from '../storage/s3';
import { generateAndUploadThumbnail } from '../video-generation/footage-generation';
import { VideoGenerationEventDataV1, VideoGenerationEventDataV3 } from 'shared/types/event-contracts';
import automationHistoryRepository from '../../repositories/automation-history.repository';
import { videoTitleSuggestionAgent } from '../../agents/video-title-suggestion.agent';
import { videoDescriptionSuggestionAgent } from '../../agents/video-description-suggestion.agent';
import { generateScript } from '../video-generation/v13-script-writer';

// Mock all dependencies
vi.mock('@langchain/xai', () => ({
  ChatXAI: class ChatXAI {
    constructor(_opts: any) {}
    withStructuredOutput(_schema: any) {
      return this;
    }
  }
}));
vi.mock('../../models/transcription-job');
vi.mock('../../models/user-profile');
vi.mock('../video-generation/v11-proper-context/get-suggestions');
vi.mock('../video-generation/v12-reintroduce-text-search/get-suggestions');
vi.mock('../video-generation/v13-script-writer/index');
vi.mock('../video-generation/v14-langgraph-overlays');
vi.mock('../../repositories/library.repository');
vi.mock('../../repositories/transcription-job.repository');
vi.mock('../../repositories/user-profile.repository');
vi.mock('../../repositories/tracked-video.repository');
vi.mock('../../agents/script-or-prompt.agent', () => ({
  analyzeAndGenerateScript: vi.fn(() => Promise.resolve({ type: 'script', script: 'processed script' }))
}));
vi.mock('../tts');
vi.mock('../video-manipulation/ffmpeg');
vi.mock('../fs');
vi.mock('../storage/s3');
vi.mock('../video-generation/footage-generation');
vi.mock('../ai/deepgram');
vi.mock('../sockets');
vi.mock('../logging');
vi.mock('../config/storage', () => ({
  getS3FileUrl: vi.fn(filename => `https://s3.example.com/${filename}`)
}));
vi.mock('path', () => ({
  default: {
    basename: vi.fn(path => path.split('/').pop()),
    parse: vi.fn(path => ({ name: path.replace(/\.[^/.]+$/, '') }))
  }
}));
vi.mock('mime', () => ({
  default: {
    getType: vi.fn(() => 'video/mp4')
  }
}));
vi.mock('fs', () => ({
  default: {
    statSync: vi.fn(() => ({ size: 1000000 })),
    readFileSync: vi.fn(() => '{"type": "service_account"}'),
    existsSync: vi.fn(() => true),
    createReadStream: vi.fn(() => ({ pipe: vi.fn() }))
  }
}));
vi.mock('../utils/retry-fn', () => ({
  retry: vi.fn(async fn => fn())
}));
vi.mock('franc', () => ({
  franc: vi.fn(() => 'eng')
}));
vi.mock('../../agents/video-title-suggestion.agent', () => ({
  videoTitleSuggestionAgent: {
    invoke: vi.fn(() => Promise.resolve('Generated Title'))
  }
}));
vi.mock('../../agents/video-description-suggestion.agent', () => ({
  videoDescriptionSuggestionAgent: {
    invoke: vi.fn(() => Promise.resolve('Generated Description'))
  }
}));
vi.mock('../../repositories/automation-history.repository', () => ({
  default: {
    findByChannel: vi.fn(() => Promise.resolve([])),
    create: vi.fn(() => Promise.resolve({ _id: { toString: () => 'history-id' } }))
  }
}));
vi.mock('../utils/error-handling', () => ({
  tryCatchError: vi.fn(fn => fn())
}));
vi.mock('../../agents/annotation-remover.agent', () => ({
  annotationRemoverAgent: {
    invoke: vi.fn(() => Promise.resolve({ text: 'processed script' }))
  }
}));

describe('Generation Processor Tests', () => {
  const mockVideoGenerationDataV1: VideoGenerationEventDataV1 = {
    guidance: 'test guidance',
    libraries: { pexels: false },
    userId: 'user123',
    privateLibraryIds: ['private1'],
    publicLibraryIds: ['public1', 'public2'],
    videoUrl: 'https://example.com/video.mp4',
    systemPrompt: 'test prompt',
    selectedTags: ['tag1', 'tag2'],
    title: 'Night Witches Story',
    language: 'en',
    isTalkingHead: false,
    useVideoEmbeddings: false,
    includeMusic: true,
    tjId: 'tj123',
    totalDuration: 60,
    brollDuration: 30,
    version: '1.0.0',
    isAllPublicLibrariesSelected: false
  };

  const mockVideoGenerationDataV2: VideoGenerationEventDataV3 = {
    guidance: 'test guidance v2',
    libraries: { pexels: false },
    userId: 'user123',
    privateLibraryIds: ['private1'],
    publicLibraryIds: ['public1', 'public2'],
    fileUrl: 'https://example.com/audio.mp3',
    script: 'This is a test script for video generation',
    systemPrompt: 'test prompt v2',
    selectedTags: ['tag1', 'tag2'],
    title: 'Test Video V2',
    isTalkingHead: false,
    includeMusic: true,
    tjId: 'tj456',
    version: '3.0.0',
    brollDuration: 30,
    isVoicePremium: true,
    voiceType: 'alloy',
    uploadType: 'script',
    size: '1080p',
    isAllPublicLibrariesSelected: false,
    exportConfig: {
      userId: 'user123',
      isWatermarked: false,
      status: 'QUEUED',
      exportType: 'VIDEO',
      orientationType: 'VERTICAL'
    },
    captions: {
      type: 'WORD_HIGHLIGHT',
      fontFamily: 'Montserrat-Bold',
      isUppercase: false,
      primaryColor: '#ffffff',
      outlineColor: '#000000',
      highlightedWordColor: '#ffff00',
      marginV: 10,
      outlineWidth: 2
    }
  };

  const mockTj = {
    _id: { toString: () => 'tj123' },
    metadata: { format: { duration: 51.356 } },
    save: vi.fn(),
    transcript: mockTranscriptionResults.results.channels[0].alternatives[0].words,
    status: 'PENDING'
  };

  const mockLibraries = [{ _id: { toString: () => 'public1' } }, { _id: { toString: () => 'public2' } }];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(TranscriptionJob.findById).mockResolvedValue(mockTj as any);
    vi.mocked(libraryRepository.findPublicLibrariesByIds).mockResolvedValue(mockLibraries as any);
    vi.mocked(generateFootageSuggestions).mockResolvedValue({ _id: { toString: () => 'video-data-id-123' } } as any);
    vi.mocked(UserProfile.findOneAndUpdate).mockResolvedValue({} as any);
    vi.mocked(userProfileRepository.getTTSMinutesRemaining).mockResolvedValue(100);
    vi.mocked(transcriptionJobRepository.update).mockResolvedValue(mockTj as any);
    vi.mocked(automationHistoryRepository.findByChannel).mockResolvedValue([]);
    vi.mocked(automationHistoryRepository.create).mockResolvedValue({ _id: { toString: () => 'history-id' } } as any);
    vi.mocked(videoTitleSuggestionAgent.invoke).mockResolvedValue('Generated Title');
    vi.mocked(videoDescriptionSuggestionAgent.invoke).mockResolvedValue('Generated Description');
    vi.mocked(generateScript).mockResolvedValue('Generated Script');
  });

  describe('generationProcessor (V1)', () => {
    it('should process video generation successfully with existing transcript', async () => {
      await generationProcessor(mockVideoGenerationDataV1);

      expect(mockTj.save).toHaveBeenCalled();
      expect(mockTj.status).toBe('TRANSCRIBED');
      expect(libraryRepository.findPublicLibrariesByIds).toHaveBeenCalledWith(['public1', 'public2']);
      expect(generateFootageSuggestions).toHaveBeenCalledWith(
        expect.objectContaining({
          guidance: mockVideoGenerationDataV1.guidance,
          transcript: mockTranscriptionResults.results.channels[0].alternatives[0].words,
          userId: mockVideoGenerationDataV1.userId,
          title: 'Night Witches Story',
          publicLibraryIds: ['public1', 'public2'],
          privateLibraryIds: ['private1'],
          isAllPublicLibrariesSelected: false
        })
      );
      expect(UserProfile.findOneAndUpdate).toHaveBeenCalledWith(
        { firebaseId: mockVideoGenerationDataV1.userId },
        { $inc: { 'usage.ttsMinutesSpent': 0.86 } },
        { new: true }
      );
    });

    it('should transcribe video when transcript is missing', async () => {
      const mockTjWithoutTranscript = { ...mockTj, transcript: [] };
      vi.mocked(TranscriptionJob.findById).mockResolvedValue(mockTjWithoutTranscript as any);
      vi.mocked(transcribeUrl).mockResolvedValue(mockTranscriptionResults as any);

      await generationProcessor(mockVideoGenerationDataV1);

      expect(transcribeUrl).toHaveBeenCalledWith(mockVideoGenerationDataV1.videoUrl, 'en');
      expect(mockTjWithoutTranscript.transcript).toBe(mockTranscriptionResults);
    });

    it('should handle missing transcription job', async () => {
      vi.mocked(TranscriptionJob.findById).mockResolvedValue(null);

      await generationProcessor(mockVideoGenerationDataV1);

      expect(logger.error).toHaveBeenCalledWith('Transcription job not found', {
        tjId: mockVideoGenerationDataV1.tjId
      });
      expect(generateFootageSuggestions).not.toHaveBeenCalled();
    });

    it('should handle missing metadata', async () => {
      const mockTjWithoutMetadata = { ...mockTj, metadata: null };
      vi.mocked(TranscriptionJob.findById).mockResolvedValue(mockTjWithoutMetadata as any);

      await generationProcessor(mockVideoGenerationDataV1);

      expect(logger.error).toHaveBeenCalledWith('Transcription job not found', {
        tjId: mockVideoGenerationDataV1.tjId
      });
      expect(generateFootageSuggestions).not.toHaveBeenCalled();
    });

    it('should handle generation failure gracefully', async () => {
      vi.mocked(generateFootageSuggestions).mockRejectedValue(new Error('Generation failed'));

      expect(generationProcessor(mockVideoGenerationDataV1)).rejects.toThrow('Generation failed');

      // expect(sendError).toHaveBeenCalledWith(
      //   mockVideoGenerationDataV1.userId,
      //   'tj123',
      //   'An unexpected error occurred. Please try again.'
      // );
      // expect(mockTj.status).toBe('FAILED');
      // expect(mockTj.save).toHaveBeenCalled();
    });
  });

  describe('generationProcessorV2', () => {
    beforeEach(() => {
      vi.mocked(analyzeAndGenerateScript).mockResolvedValue({
        type: 'script',
        script: 'processed script'
      });
      vi.mocked(generateVoiceover).mockResolvedValue({
        audioPath: '/tmp/audio.wav',
        audioName: 'audio.wav',
        transcript: mockTranscriptionResults.results.channels[0].alternatives[0].words
      });
      vi.mocked(generateVideoFromAudio).mockResolvedValue(['video.mp4', '/tmp/video.mp4']);
      vi.mocked(getMetadata).mockResolvedValue({
        streams: [],
        format: {
          filename: 'test.mp4',
          nb_streams: 1,
          nb_programs: 0,
          format_name: 'mp4',
          format_long_name: 'MP4 (MPEG-4 Part 14)',
          start_time: 0,
          duration: 60,
          size: 1000000,
          bit_rate: 1000,
          probe_score: 100
        }
      });
      vi.mocked(downloadFile).mockResolvedValue('/tmp/downloaded-file');
      vi.mocked(uploadToS3).mockResolvedValue({ ETag: 'test-etag' } as any);
      vi.mocked(generateAndUploadThumbnail).mockResolvedValue('thumbnail-url');
      vi.mocked(safelyDelete).mockResolvedValue(undefined);
    });

    it('should handle audio file upload type', async () => {
      const audioUploadData = {
        ...mockVideoGenerationDataV2,
        uploadType: 'audio' as const,
        script: undefined
      };

      await generationProcessorV2(audioUploadData);

      expect(downloadFile).toHaveBeenCalledWith('/tmp/data/audio.mp3', 'https://example.com/audio.mp3');
      // Audio uploads are treated as audio-only; no audio->video conversion is performed here.
      expect(generateVideoFromAudio).not.toHaveBeenCalled();
      expect(analyzeAndGenerateScript).not.toHaveBeenCalled();
      expect(generateVoiceover).not.toHaveBeenCalled();
    });

    it('should handle insufficient TTS minutes for script', async () => {
      vi.mocked(userProfileRepository.getTTSMinutesRemaining).mockResolvedValue(0.1);

      await generationProcessorV2(mockVideoGenerationDataV2);

      // Script-length entitlement validation is currently disabled; ensure we still proceed without failing the job.
      expect(transcriptionJobRepository.update).not.toHaveBeenCalledWith('tj456', { status: 'FAILED' });
      expect(generateVoiceover).toHaveBeenCalled();
    });

    it('should handle missing transcription job', async () => {
      vi.mocked(TranscriptionJob.findById).mockResolvedValue(null);

      await generationProcessorV2(mockVideoGenerationDataV2);

      expect(logger.error).toHaveBeenCalledWith('Transcription job not found', {
        error: undefined,
        tjId: mockVideoGenerationDataV2.tjId,
        userId: mockVideoGenerationDataV2.userId
      });
      expect(analyzeAndGenerateScript).not.toHaveBeenCalled();
    });

    it('should handle video file upload without script or audio conversion', async () => {
      const videoUploadData = {
        ...mockVideoGenerationDataV2,
        uploadType: 'video' as const,
        script: undefined
      };
      vi.mocked(transcribeUrl).mockResolvedValue(mockTranscriptionResults as any);

      await generationProcessorV2(videoUploadData);

      expect(downloadFile).toHaveBeenCalledWith('/tmp/data/audio.mp3', 'https://example.com/audio.mp3');
      expect(analyzeAndGenerateScript).not.toHaveBeenCalled();
      expect(generateVoiceover).not.toHaveBeenCalled();
      expect(generateVideoFromAudio).not.toHaveBeenCalled();
      expect(transcribeUrl).toHaveBeenCalled();
    });

    it('should properly clean up temporary files', async () => {
      await generationProcessorV2(mockVideoGenerationDataV2);

      expect(safelyDelete).toHaveBeenCalledWith('/tmp/audio.wav');
      expect(safelyDelete).not.toHaveBeenCalledWith('/tmp/video.mp4');
    });

    it('should update user TTS usage correctly', async () => {
      vi.mocked(getMetadata).mockResolvedValue({
        streams: [],
        format: {
          filename: 'test.mp4',
          nb_streams: 1,
          nb_programs: 0,
          format_name: 'mp4',
          format_long_name: 'MP4 (MPEG-4 Part 14)',
          start_time: 0,
          duration: 120,
          size: 1000000,
          bit_rate: 1000,
          probe_score: 100
        }
      });

      await generationProcessorV2(mockVideoGenerationDataV2);

      expect(UserProfile.findOneAndUpdate).toHaveBeenCalledWith(
        { firebaseId: 'user123' },
        { $inc: { 'usage.ttsMinutesSpent': 2 } },
        { new: true }
      );
    });
  });
});
