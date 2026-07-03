import { useVideoCaptionsReducer } from './useVideoCaptionsReducer';
import { useCallback, useMemo, useState } from 'react';
import { CaptionSettings, VideoMetadata, WordBase, VideoAIData } from '../types';
import 'rc-slider/assets/index.css';
import { getAdjustedVisibleWords } from 'shared/utils/trimming';
import { presets } from '../components/video-editor/CaptionModal';
import { useDisclosure } from '@chakra-ui/react';
import { useApiService } from './useApiService';
import { useQuery } from 'react-query';
import { useUserId } from '../contexts/firebase/hooks';
import { getSrtFileString } from 'shared/utils/captions';

export const useVideoCaptions = ({ editedWordsList, data }: { editedWordsList?: WordBase[]; data: VideoAIData }) => {
  const apiService = useApiService();
  const userId = useUserId();
  const {
    isOpen: isCaptionsModalOpen,
    onClose: onCaptionsModalClose,
    onOpen: setIsCaptionsModalOpen
  } = useDisclosure();
  const [captions, setCaptions] = useState<CaptionSettings>(() => {
    return data.captions ?? presets[0];
  });
  const captionWords = useMemo(() => {
    let out: WordBase[] = [];
    if (editedWordsList) {
      out = getAdjustedVisibleWords(editedWordsList);
    } else {
      out =
        data.transcriptionJob?.deepgramResults?.results?.channels?.[0]?.alternatives?.[0]?.words ?? [];
    }
    return out;
  }, [data, editedWordsList]);
  const captionsState = useVideoCaptionsReducer({ data: captionWords });

  const { data: captionPresets, refetch: refetchCaptionPresets } = useQuery({
    queryKey: ['clientCaptions', userId],
    queryFn: async () => {
      return await apiService.get<CaptionSettings[]>(`/api/captions`);
    },
    onSuccess: caps => {
      if (!data.captions && caps.length > 0) {
        setCaptions(caps.find(c => c.isDefault) ?? caps[0]);
      }
    },
    refetchOnMount: 'always'
  });

  const onSaveCaptionPreset = useCallback(
    async (captions: CaptionSettings) => {
      if (captions._id) {
        await apiService.put<void, CaptionSettings>(`/api/captions/${captions._id}`, captions);
        await refetchCaptionPresets();
      }
      setCaptions(captions);
    },
    [apiService, refetchCaptionPresets]
  );

  const downloadSubtitles = () => {
    const derivedDuration =
      data.segments?.length ? Math.max(...data.segments.map(s => s.timeEnd)) : 20;
    const metadata: VideoMetadata =
      data.source?.metadata ??
      ({ format: { duration: derivedDuration }, streams: [] } as unknown as VideoMetadata);
    const srtContent = getSrtFileString({
      videoMetadata: metadata,
      transcript: captionsState.transcript
    });

    const blob = new Blob([srtContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.title}.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return {
    captions,
    captionWords,
    captionsState,
    captionPresets,
    isCaptionsModalOpen,
    downloadSubtitles,
    onCaptionsModalClose,
    setIsCaptionsModalOpen,
    refetchCaptionPresets,
    onSaveCaptionPreset
  };
};
