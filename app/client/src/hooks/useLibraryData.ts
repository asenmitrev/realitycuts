import { useQuery } from 'react-query';
import { useApiService } from './useApiService';
import { IPopulatedLibrary, IBrollFootageMetadata } from '../types';

const BROLL_PER_PAGE = 24;

interface LibraryDataResponse {
  library: IPopulatedLibrary;
  youtubeLinks: { url: string; count: number }[];
}

interface BrollDataResponse {
  broll: IBrollFootageMetadata[];
  total: number;
}

export const useLibraryData = (id: string | undefined, currentPage: number) => {
  const apiService = useApiService();

  const {
    data: libraryData,
    isLoading: isLoadingLibrary,
    refetch: refetchLibrary
  } = useQuery<LibraryDataResponse>({
    queryKey: ['library', id],
    queryFn: async () => {
      const response = await apiService.get<LibraryDataResponse>(`/api/library/${id}`);
      return response;
    },
    enabled: !!id
  });

  const {
    data: brollData,
    isLoading: isLoadingBroll,
    refetch: refetchBroll
  } = useQuery<BrollDataResponse>({
    queryKey: ['library', id, 'broll', currentPage],
    queryFn: async () => {
      const response = await apiService.get<BrollDataResponse>(
        `/api/library/${id}/broll?skip=${currentPage * BROLL_PER_PAGE}&limit=${BROLL_PER_PAGE}`
      );
      return response;
    },
    enabled: !!id
  });

  return {
    library: libraryData?.library,
    youtubeLinks: libraryData?.youtubeLinks ?? [],
    brollItems: brollData?.broll ?? [],
    totalBroll: brollData?.total ?? 0,
    isLoadingLibrary,
    isLoadingBroll,
    refetchLibrary,
    refetchBroll
  };
};

export { BROLL_PER_PAGE };

