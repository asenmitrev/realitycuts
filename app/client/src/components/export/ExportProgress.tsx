import { FC, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Container, Spinner, Text, VStack } from '@chakra-ui/react';
import { useQuery } from 'react-query';
import { useMessages } from '../../hooks/useMessages';
import { ProgressReportV2 } from '../common/ProgressReportV2';
import { useApiService } from '../../hooks/useApiService';

export const ExportProgress: FC = () => {
  const { eventId } = useParams();
  const data = useMessages(eventId ?? '', 'DATA');
  const navigate = useNavigate();
  const apiService = useApiService();
  const [urlSearchParams, setUrlSearchParams] = useSearchParams();

  const { data: exportJob } = useQuery({
    queryKey: ['exportJob', eventId],
    queryFn: () => apiService.get<{ status: string }>(`/api/exports/${eventId}`),
    enabled: !!eventId
  });

  useEffect(() => {
    const backTo = urlSearchParams.get('backTo');
    if (!data) return;
    for (const datum of data) {
      if (datum?.data?._id) {
        if (backTo) {
          navigate(backTo);
        } else {
          navigate(`/exports/${datum?.data?._id}`, { replace: true });
        }
      }
    }
  }, [data, eventId, urlSearchParams, setUrlSearchParams, navigate]);

  if (exportJob?.status === 'PENDING_PAYMENT') {
    return (
      <Container minW={{ base: '100%', md: '400px' }} py={8}>
        <VStack spacing={4} align="center">
          <Spinner size="lg" />
          <Text fontWeight="medium">Waiting for payment confirmation...</Text>
          <Text fontSize="sm" color="gray.400" textAlign="center">
            If you just completed payment, your export will start shortly. This page will update automatically.
          </Text>
        </VStack>
      </Container>
    );
  }

  return (
    <Container minW={{ base: '100%', md: '400px' }}>
      {eventId ? <ProgressReportV2 eventId={eventId} title="Exporting..." /> : 'Export not found.'}
    </Container>
  );
};
