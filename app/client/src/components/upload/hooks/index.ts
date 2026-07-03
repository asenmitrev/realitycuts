import { useMemo, useState } from 'react';
import { useToast } from '@chakra-ui/react';
import { useApiService } from '../../../hooks/useApiService';
import { useForm } from 'react-hook-form';
import { useQuery as useReactQuery } from 'react-query';
import { AxiosProgressEvent } from 'axios';
import { useRole } from '../../../contexts/profile/hooks';
import { ElevenLabsVoice, UploadFormData, UploadType } from '../../../types';
import { useUserId } from '../../../contexts/firebase/hooks';
import { getVoices } from '../../../utils/voices';
import { profileRemainingLibraryMinutes } from '../../../utils';
import { approximateMinutesFromText } from 'shared/utils/misc';
import { useProfile } from '../../../contexts/profile/hooks';
import { ApiError } from '../../../service/apiService';
import { useUploadScriptsStore } from '../../../stores/uploadScriptsStore';

const defaultSize = '1080p';
const defaultValues = {
  title: '',
  systemPrompt: '',
  pexels: false,
  guidance: '',
  script: '',
  includeMusic: false,
  useVideoEmbeddings: false,
  size: defaultSize,
  voiceType: 'cjVigY5qzO86Huf0OWal',
  isVoicePremium: true,
  pinecone: true,
  fileLinks: '',
  brollDuration: 3,
  selectedTags: [],
  libraries: [],
  isAllPublicLibrariesSelected: true,
  orientation: 'vertical' as const
} as UploadFormData;

export const useUploadForm = ({
  uploadType,
  isSample
}: {
  uploadType: UploadType | 'scriptAudio';
  isSample?: boolean;
}) => {
  const userId = useUserId();
  const role = useRole();
  const toast = useToast();
  const apiService = useApiService();
  const userProfile = useProfile();
  const [file, setFile] = useState<File>();
  const [fileDuration, setFileDuration] = useState<number>();
  const [uploadProgress, setUploadProgress] = useState<AxiosProgressEvent>();
  const methods = useForm<UploadFormData>({
    mode: 'onChange',
    defaultValues: useMemo(() => {
      return !isSample
        ? localStorage.getItem('form_data' + userId)
          ? { ...defaultValues, ...JSON.parse(localStorage.getItem('form_data' + userId) || '') }
          : defaultValues
        : {
          ...defaultValues,
          voiceType: 'onyx',
          selectedTags: [{ tag: 'Japanese Archery', libraryId: '678016f73af5c37d12eb1690', videoCount: 1000 }],
          isAllPublicLibrariesSelected: false
        };
    }, [userId, isSample])
  });

  const { data: premiumVoices } = useReactQuery({
    queryKey: ['premiumVoices'],
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    enabled: role === 'user',
    queryFn: async () => {
      return await apiService.get<ElevenLabsVoice[]>('/api/premium/voices');
    }
  });
  const voices = useMemo(() => getVoices(premiumVoices), [premiumVoices]);

  const onUploadSuccess = () => {
    setFile(undefined);
    setUploadProgress(undefined);
    const formData = JSON.parse(localStorage.getItem('form_data' + userId) ?? '{}');
    if (formData) {
      delete formData.script;
      delete formData.title;
      localStorage.setItem('form_data' + userId, JSON.stringify(formData));
      useUploadScriptsStore.getState().resetVideoScripts();
    }
  };
  const uploadFileViaPresignedUrl = async (file: File, duration?: number): Promise<string> => {
    // Step 1: Get presigned URL
    const { uploadId, presignedUrl } = await apiService.post<
      { uploadId: string; presignedUrl: string; s3Key: string },
      { filename: string; contentType: string; size: number; duration?: number }
    >('/api/upload/presigned', {
      filename: file.name,
      contentType: file.type,
      size: file.size,
      ...(duration !== undefined && { duration })
    });

    // Step 2: Upload file directly to S3 with progress tracking
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', event => {
        if (event.lengthComputable) {
          const progress = {
            loaded: event.loaded,
            total: event.total,
            lengthComputable: true
          } as AxiosProgressEvent;
          setUploadProgress(progress);
        }
      });

      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            // Step 3: Confirm upload completion
            await apiService.post(`/api/upload/${uploadId}/confirm`, {});
            setUploadProgress(undefined);
            resolve(uploadId);
          } catch (error) {
            reject(new Error('Failed to confirm upload'));
          }
        } else {
          reject(new Error(`Upload failed: ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Upload failed'));
      };

      xhr.open('PUT', presignedUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    });
  };

  const uploadFile = async ({
    title,
    guidance,
    size = '1080p',
    voiceType,
    brollDuration,
    script,
    systemPrompt,
    includeMusic,
    pexels,
    pinecone,
    libraries,
    selectedTags,
    isAllPublicLibrariesSelected,
    orientation
  }: UploadFormData) => {
    // Check TTS minutes for script uploads
    if (uploadType === 'script' || uploadType === 'prompt') {
      const videoScripts = useUploadScriptsStore.getState().videoScripts;
      const totalEstimatedMinutes = Math.ceil(
        videoScripts.reduce((total, video) => {
          return total + approximateMinutesFromText(video.script);
        }, 0)
      );
      const remainingMinutes = Math.ceil(profileRemainingLibraryMinutes(userProfile));

      if (totalEstimatedMinutes > remainingMinutes) {
        toast({
          description: 'You do not have enough TTS minutes remaining to generate these videos.',
          status: 'error'
        });
        return;
      } else {
        // Allow 5 minutes for horizontal videos, 10 minutes for vertical
        const maxMinutes = orientation === 'horizontal' ? 10 : 10;
        if (totalEstimatedMinutes > maxMinutes) {
          toast({
            description: `The script you entered is too long. Please shorten it to ${maxMinutes} minutes or less.`,
            status: 'error'
          });
          return;
        }
      }
    }

    const formDataPayload = new FormData();
    let uploadId: string | undefined;

    // Handle file upload via presigned URLs
    if ((uploadType === 'video' || uploadType === 'highlight' || uploadType === 'audio') && file) {
      try {
        uploadId = await uploadFileViaPresignedUrl(file, fileDuration);
      } catch (error) {
        toast({
          description: `File upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          status: 'error'
        });
        return;
      }
    } else if ((uploadType === 'script' || uploadType === 'prompt') && !script) {
      toast({
        description: 'Please provide a script.',
        status: 'error'
      });
      return;
    }
    if (title) {
      formDataPayload.append('title', title);
    }
    formDataPayload.append('guidance', guidance);
    formDataPayload.append('includeMusic', `${includeMusic}`);
    formDataPayload.append('pexels', `${pexels}`);
    formDataPayload.append('uploadType', `${uploadType}`);
    formDataPayload.append('useVideoEmbeddings', `true`);
    const selectedTagIds = selectedTags.filter(t => t.libraryId === null).map(t => t.tag);
    if (selectedTags.length > 0) {
      formDataPayload.append('selectedTags', `${selectedTagIds.join(',')}`);
    }

    const privateLibraryIdsToSend = [...(libraries?.filter(l => l.isSelected).map(l => l._id) ?? [])];

    const publicLibraryIdsToSend = [
      ...(pinecone ? selectedTags.filter(t => t.libraryId !== null).map(t => t.libraryId) : [])
    ];
    if (
      selectedTagIds.length === 0 &&
      privateLibraryIdsToSend.length === 0 &&
      publicLibraryIdsToSend.length === 0 &&
      !pexels &&
      !isAllPublicLibrariesSelected
    ) {
      toast({
        description: 'You must select at least one library to upload.',
        status: 'error'
      });
      return;
    }
    if (privateLibraryIdsToSend?.length) {
      formDataPayload.append('privateLibraryIds', `${privateLibraryIdsToSend.join(',')}`);
    }
    if (publicLibraryIdsToSend?.length) {
      formDataPayload.append('publicLibraryIds', `${publicLibraryIdsToSend.join(',')}`);
    }
    if (script && (uploadType === 'script' || uploadType === 'prompt')) {
      formDataPayload.append('script', `${script}`);
    }
    if (voiceType) {
      formDataPayload.append('voiceType', `${voiceType}`);
      formDataPayload.append('voicePremium', `${voices.find(v => v.id === voiceType)?.premium ?? false}`);
    }
    if (size) {
      formDataPayload.append('size', `${size}`);
    }

    if (brollDuration) {
      formDataPayload.append('brollDuration', `${brollDuration}`);
    }

    if (systemPrompt) {
      formDataPayload.append('systemPrompt', systemPrompt);
    }

    if (uploadId) {
      formDataPayload.append('uploadId', uploadId);
    }

    if (isAllPublicLibrariesSelected !== undefined) {
      formDataPayload.append('isAllPublicLibrariesSelected', `${isAllPublicLibrariesSelected}`);
    }
    if (orientation && (uploadType === 'prompt' || uploadType === 'script')) {
      formDataPayload.append('orientation', orientation);
    }
    try {
      const { eventId } = await apiService.post<{ success: boolean; eventId: string }, FormData>(
        '/api/videos',
        formDataPayload,
        {
          onProgress: progress => setUploadProgress(progress),
          forceRefresh: true
        }
      );
      onUploadSuccess();
      return eventId;
    } catch (error) {
      if (error instanceof ApiError) {
        const errorData = error.data as { message?: string };
        const message = errorData?.message || error.message || 'Failed to create project';
        toast({
          title: 'Error',
          description: message,
          status: 'error',
          duration: 5000,
          isClosable: true
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to create project',
          status: 'error',
          duration: 5000,
          isClosable: true
        });
      }
      throw error;
    }
  };

  const onSubmit = (props: UploadFormData) => {
    if (uploadType === 'scriptAudio') {
      return;
    } else {
      return uploadFile(props);
    }
  };
  const setFileWithDuration = (file: File | undefined, duration?: number) => {
    setFile(file);
    setFileDuration(duration);
  };

  return { methods, onSubmit, file, voices, setFile: setFileWithDuration, uploadProgress };
};
