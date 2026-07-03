import { MobileVideoEditorNotice } from '../common/MobileVideoEditorNotice';
import { GlobalSpinner } from '../common/GlobalSpinner';
import { PopulatedVideoAIData } from './Video';
import { useParams } from 'react-router-dom';
import { useQuery } from 'react-query';
import { useBreakpointValue } from '@chakra-ui/react';
import { useApiService } from '../../hooks/useApiService';
import { VideoContainer } from './VideoContainer';

export const VideoPage = () => {
  const { id } = useParams();
  const apiService = useApiService();
  const isDesktop = useBreakpointValue({ base: false, md: true }, { ssr: false });
  const { data, refetch } = useQuery({
    queryKey: ['videoAiData', id],
    queryFn: async () => {
      return await apiService.get<PopulatedVideoAIData>(`/api/videos/${id}`);
    },
    refetchOnMount: false
  });

  if (isDesktop) {
    return data ? <VideoContainer data={data} refetch={refetch} /> : <GlobalSpinner />;
  }

  return <MobileVideoEditorNotice />;
};
