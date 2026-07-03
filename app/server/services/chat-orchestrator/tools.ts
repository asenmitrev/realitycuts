/**
 * Chat Orchestrator Tools
 *
 * Tools for the chat orchestrator to search and analyze footage libraries.
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { searchClustersByQuery, ClusterInfo } from '../vector-search.service';
import libraryRepository from '../../repositories/library.repository';

/**
 * Schema for searching library footage
 */
const searchLibraryFootageSchema = z.object({
  libraryIds: z.array(z.string()).describe('Array of library IDs to search in'),
  query: z.string().describe('The topic or query to search for')
});

/**
 * Search library footage tool
 *
 * Uses cluster-based semantic search to find what content is available
 * for a given topic. Returns formatted cluster information for LLM consumption.
 */
export const searchLibraryFootageTool = new DynamicStructuredTool({
  name: 'search_library_footage',
  description:
    'Search footage libraries to see what content is available for a topic. Returns clusters of similar videos showing what kinds of footage exist.',
  schema: searchLibraryFootageSchema,
  func: async (input: { libraryIds: string[]; query: string }): Promise<string> => {
    const clusterInfos = await searchClustersByQuery(input.query, 10, input.libraryIds);

    if (clusterInfos.length === 0) {
      return 'No footage found matching this topic.';
    }

    return clusterInfos
      .map(cluster => `${cluster.documentsInCluster} videos similar to: ${cluster.topMatch.title}`)
      .join('\n\n');
  }
});

/**
 * Search for available footage clusters given a topic and user ID
 *
 * This is a direct function (not a tool) for use in nodes.
 *
 * @param query - The topic to search for
 * @param userId - The user's Firebase ID to get their libraries
 * @returns Formatted cluster results and raw cluster info
 */
export async function searchFootageClusters(
  query: string,
  userId: string
): Promise<{
  formattedResults: string;
  clusters: ClusterInfo[];
  totalVideos: number;
}> {
  // Get user's private library IDs
  const userLibraries = await libraryRepository.findAllByUserId(userId);
  const privateLibraryIds = userLibraries.map(lib => lib._id!.toString());

  // Search clusters with the query
  // Note: searchClustersByQuery already handles the vector search filtering
  const clusters = await searchClustersByQuery(query, 10, privateLibraryIds);

  if (clusters.length === 0) {
    return {
      formattedResults: 'No footage found matching this topic.',
      clusters: [],
      totalVideos: 0
    };
  }

  // Calculate total videos across all clusters
  const totalVideos = clusters.reduce((sum, cluster) => sum + cluster.documentsInCluster, 0);

  // Format results for LLM consumption
  const formattedResults = clusters
    .map(cluster => `${cluster.documentsInCluster} videos similar to: ${cluster.topMatch.title}`)
    .join('\n\n');

  return {
    formattedResults,
    clusters,
    totalVideos
  };
}
