import { Alternative } from '../../../../types';
import { searchPexelsVideos } from '../../../pexels';
import { searchVideoEmbeddingsV2 } from '../../../vector-search.service';

import { SHOT_TYPE } from '../const';
const PINECONE_SEARCH_LIMIT = 10;

export const searchLibrary = async ({
  firstSearchPrompt,
  secondSearchPrompt,
  vectorSearchPrompt,
  userId,
  selectedTags,
  privateLibraryIds,
  existingPineconeIds,
  libraries,
  shotType,
  useVideoEmbeddings,
  isAllPublicLibrariesSelected = false,
  includeVectorInOutput = false,
  filterOnlyBroll = false
}: {
  firstSearchPrompt: string;
  secondSearchPrompt: string;
  vectorSearchPrompt: string;
  userId: string;
  selectedTags: string[];
  privateLibraryIds: string[];
  existingPineconeIds: string[];
  libraries: { pexels: boolean };
  shotType?: (typeof SHOT_TYPE)[keyof typeof SHOT_TYPE];
  useVideoEmbeddings: boolean;
  isAllPublicLibrariesSelected?: boolean;
  includeVectorInOutput?: boolean;
  filterOnlyBroll?: boolean;
}) => {
  // const pineconeSearch = useVideoEmbeddings ? searchVideoEmbeddings : searchPinecone;
  // Search: Get the stock footage suggestions for the sentence
  const [stockResults, pexelsResults, videoVectorResults] = await Promise.all([
    Promise.resolve([[], firstSearchPrompt]),
    libraries.pexels ? searchPexelsVideos(firstSearchPrompt, 3) : Promise.resolve([]),
    selectedTags?.length || privateLibraryIds?.length || isAllPublicLibrariesSelected
      ? searchVideoEmbeddingsV2(
          `${vectorSearchPrompt}`,
          PINECONE_SEARCH_LIMIT,
          privateLibraryIds,
          existingPineconeIds,
          undefined,
          isAllPublicLibrariesSelected,
          includeVectorInOutput,
          filterOnlyBroll
        ).then(results =>
          results.map((p, index) => ({
            ...p
          }))
        )
      : Promise.resolve([])
  ]);
  return [stockResults, pexelsResults, videoVectorResults] as [
    [Alternative[], string],
    Alternative[],
    (Alternative & { dbId?: string })[]
  ];
};
