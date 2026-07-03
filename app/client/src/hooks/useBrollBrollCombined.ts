import { useQuery } from 'react-query';
import { useApiService } from './useApiService';
import { IBrollFootageMetadata } from '../types';

const BROLL_PER_PAGE = 24;

interface BrollDataResponse {
  broll: IBrollFootageMetadata[];
  total: number;
}

export const useBrollBrollCombined = (libraryId: string | undefined, currentPage: number) => {
  const apiService = useApiService();

  const {
    data: brollData,
    isLoading: isLoadingBroll,
    refetch: refetchBroll
  } = useQuery<BrollDataResponse>({
    queryKey: ['library', libraryId, 'broll', 'broll-combined', currentPage],
    queryFn: async () => {
      const response = await apiService.get<BrollDataResponse>(
        `/api/library/${libraryId}/broll/broll-combined?skip=${currentPage * BROLL_PER_PAGE}&limit=${BROLL_PER_PAGE}`
      );
      return response;
    },
    enabled: !!libraryId
  });

  return {
    brollItems: brollData?.broll ?? [],
    totalBroll: brollData?.total ?? 0,
    isLoadingBroll,
    refetchBroll
  };
};

export { BROLL_PER_PAGE };
