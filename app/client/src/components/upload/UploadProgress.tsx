import { FC, useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Flex, Box } from '@chakra-ui/react';
import { useMessages } from '../../hooks/useMessages';
import { useApiService } from '../../hooks/useApiService';
import { ProgressReportV2 } from '../common/ProgressReportV2';
import { SurveyModal } from '../common/SurveyModal';
import { useSurvey } from '../../hooks/useSurvey';
import { useUserId } from '../../contexts/firebase/hooks';

export const UploadProgress: FC = () => {
  const { eventId } = useParams();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const showDisclaimer = searchParams.get('showDisclaimer') === 'true';
  const data = useMessages(eventId ?? '', 'DATA');
  const navigate = useNavigate();
  const apiService = useApiService();
  const [isDeleting, setIsDeleting] = useState(false);

  const { shouldShowSurvey, markSurveyCompleted, isLoading } = useSurvey();
  const userId = useUserId();

  const handleSurveyClose = () => {
    markSurveyCompleted();
  };
  useEffect(() => {
    if (!data) return;
    for (const datum of data) {
      if (datum?.data?._id) {
        if (datum.data.isHighlight) {
          return navigate(`/highlight/${datum.data._id}/${datum.data.highlightId}`, { state: datum });
        } else if (datum?.data?._id) {
          return navigate(`/videos/${datum.data._id}`);
        }
      }
    }
  }, [data, eventId, navigate]);

  const onDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      await apiService.delete(`/api/transcription-jobs/${eventId}`);
      navigate('/');
    } catch (e) {
      console.error(e);
    } finally {
      setIsDeleting(false);
    }
  }, [apiService, navigate, eventId]);

  return (
    <Flex
      direction={{ base: 'column', lg: showDisclaimer ? 'row' : 'column' }}
      align={{ base: 'center', lg: showDisclaimer ? 'flex-start' : 'center' }}
      justify="center"
      gap={6}
      px={4}
      w="100%"
      maxW={showDisclaimer ? '1100px' : 'xl'}
      mx="auto"
    >
      <Box minW={{ base: '100%', md: '400px' }} flex="1">
        {eventId ? (
          <ProgressReportV2
            isDeleting={isDeleting}
            eventId={eventId}
            onDelete={onDelete}
            showDisclaimer={showDisclaimer}
          />
        ) : (
          'Upload not found'
        )}
      </Box>
      {!isLoading && null && userId && shouldShowSurvey && (
        <SurveyModal isOpen={true} onClose={handleSurveyClose} onComplete={markSurveyCompleted} />
      )}
    </Flex>
  );
};
