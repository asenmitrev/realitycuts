import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { BadRequestError } from '../errors';
import { logger } from '../services/logging';
import libraryRepository from '../repositories/library.repository';
import { contextAnalysisAgent } from '../agents/context-analysis.agent';
import { searchPexelsVideos } from '../services/pexels';
import { searchMongoVideoEmbeddingsByLibrary, searchVideoEmbeddingsV2 } from '../services/vector-search.service';

export default {
  /**
   * Search for footage from different sources
   */
  searchFootage: async (req: AuthenticatedRequest, res: Response) => {
    const query = req.body.query;
    const source = req.body.source as 'libraries' | 'pexels' | 'public' | 'personal';
    const userId = req.user!.user_id;
    const tags = req.body.tags;
    const privateLibraryIds = req.body.privateLibraryIds;
    const metadataFilters = req.body.metadataFilters as {
      framing?: string;
      cameraAngle?: string;
      perspective?: string;
      depthOfField?: string;
      complexity?: string;
      arollBroll?: string;
      focusPosition?: string;
      clusterId?: string;
    };

    logger.info(`Searching for footage in ${source}`, {
      'User ID': userId,
      'Search Term': query,
      Source: source,
      'Metadata Filters': metadataFilters
    });

    switch (source) {
      case 'pexels':
        // Use the pexels service for searching
        const pexelsResults = await searchPexelsVideos(query, 20);
        res.json(pexelsResults);
        break;

      case 'libraries':
      case 'public':
      case 'personal':
        // Validate that we have either tags or private library IDs
        // if ((!tags || tags.length === 0) && (!privateLibraryIds || privateLibraryIds.length === 0)) {
        //   throw new BadRequestError('Invalid request, please select at least one tag or private library.');
        // }

        if (query === '') {
          const brollResults = await libraryRepository.findBrollByMetadataFilters(
            privateLibraryIds ?? [],
            metadataFilters
          );
          res.json(brollResults);
          break;
        }

        // Use vector search for semantic searching with metadata filters
        const vectorResults = await searchVideoEmbeddingsV2(query, 20, privateLibraryIds, undefined, metadataFilters);
        res.json(vectorResults);
        break;

      default:
        throw new BadRequestError('Invalid source');
    }
  },

  /**
   * Suggest public libraries based on script context
   */
  autosuggestPublicLibraries: async (req: AuthenticatedRequest, res: Response) => {
    const script = req.body.script;
    const userId = req.user!.user_id;

    // Analyze the script context
    const context = await contextAnalysisAgent.invoke({ script });

    // Search for video embeddings by library
    const libraryIds = await searchMongoVideoEmbeddingsByLibrary(context);

    // Get the public libraries
    const publicLibraries = await libraryRepository.findPublicLibrariesByIds(libraryIds);

    // Filter out libraries owned by the current user
    const filteredLibraries = publicLibraries.filter(library => library.userId !== userId);

    // Get video counts and screenshots for each library
    const libraryResults = await Promise.all(
      filteredLibraries.map(async library => {
        // Count videos in this library
        const videoCount = await libraryRepository.countBrollByLibraryId(String(library._id));

        // Get screenshots
        const screenshots = await libraryRepository.getBrollScreenshotsByLibraryId(String(library._id), 10);

        return {
          libraryId: library._id,
          videoCount,
          tag: library.title,
          screenshots: screenshots
        };
      })
    );

    // Only return libraries that have videos
    const result = libraryResults.filter(
      (library): library is { libraryId: string; videoCount: number; tag: string; screenshots: string[] } => {
        return !!library.libraryId && library.videoCount > 0;
      }
    );

    res.json(result);
  }
};
