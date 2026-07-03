import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { TavilySearch } from '@langchain/tavily';
import { getSampledLibraryInfo } from '../../../agents/library-aware-script.agent';
import { TAVILY_API_KEY } from '../../../config/const';
import automationHistoryRepository from '../../../repositories/automation-history.repository';
import { searchClustersByQuery } from '../../vector-search.service';
const schema = z.object({
  libraryIds: z.array(z.string())
});
export const getSampledLibraryInfoTool = new DynamicStructuredTool({
  name: 'get_sampled_library_info',
  description: 'Get a sample of videos from the passed in library ids, representing what is available in the libraries',
  schema,
  func: async (input: { libraryIds: string[] }): Promise<string> => {
    return await getSampledLibraryInfo(input.libraryIds);
  }
});

const searchLibraryFootageSchema = z.object({
  libraryIds: z.array(z.string()),
  query: z.string()
});
export const searchLibraryFootage = new DynamicStructuredTool({
  name: 'search_library_footage',
  description: 'Search the footage library to see if there is any footage that matches the query',
  schema: searchLibraryFootageSchema,
  func: async (input: { libraryIds: string[]; query: string }): Promise<string> => {
    const clusterInfos = await searchClustersByQuery(input.query, 10, input.libraryIds);
    return clusterInfos
      .map(cluster => `${cluster.documentsInCluster} videos similar to this: \n\n ${cluster.topMatch.title}`)
      .join('\n\n');
  }
});

// Lazy so the server can boot without TAVILY_API_KEY; the constructor
// throws when the key is missing.
let _tavilyWebSearch: TavilySearch | undefined;
export const getTavilyWebSearch = (): any => {
  if (!_tavilyWebSearch) {
    _tavilyWebSearch = new TavilySearch({
      tavilyApiKey: TAVILY_API_KEY,
      maxResults: 10
    });
  }
  return _tavilyWebSearch;
};

export const getHistory = async (channelId: string) => {
  const history = await automationHistoryRepository.findByChannel(channelId, 20);
  return history.map(video => video.script.substring(0, 300)).join('\n\n\n');
};
