import { Alternative } from 'shared/types';
import { SHOT_TYPE } from './video-generation/v11-proper-context/const';
import { AROLL_BROLL_CATEGORIES, FRAMING_CATEGORIES } from 'shared/types/video-categorization';
import { createTextEmbeddings } from './ai/vertex';
import { BrollFootageMetadata } from '../models/broll-video-metadata';
import { ObjectId } from 'mongodb';
import { ENVIRONMENT } from '../config/const';
import { logger } from 'server/services/logging';
// Helper function to determine leftPosition based on face detection results and actual video dimensions
const calculateLeftPositionFromFaces = (
  faceDetectionResults?: any,
  videoDimensions?: { width: number; height: number; aspect_ratio: number; orientation: string }
): number => {
  if (!faceDetectionResults) {
    return 1; // Default center position
  }

  // Check both frame timestamps and use the one with more faces, or 0.5s by default
  const frame05s = faceDetectionResults.frame05s;
  const frame25s = faceDetectionResults.frame25s;

  let selectedFrame = frame05s;
  if (frame25s && frame25s.faceCount > 0 && (!frame05s || frame25s.faceCount > frame05s.faceCount)) {
    selectedFrame = frame25s;
  }

  if (
    !selectedFrame ||
    !selectedFrame.faces ||
    selectedFrame.faces.length === 0 ||
    selectedFrame.faces.length > 4 ||
    !videoDimensions
  ) {
    return 1; // Default center position if no faces detected
  }

  // For multiple faces, use the most prominent one (largest area or highest confidence)
  let prominentFace = selectedFrame.faces[0];
  for (const face of selectedFrame.faces) {
    const currentArea = face.width * face.height;
    const prominentArea = prominentFace.width * prominentFace.height;

    // Choose face with higher confidence, or larger area if confidence is similar
    if (
      face.confidence > prominentFace.confidence + 0.1 ||
      (Math.abs(face.confidence - prominentFace.confidence) <= 0.1 && currentArea > prominentArea)
    ) {
      prominentFace = face;
    }
  }

  // Calculate the center of the face
  const faceCenterX = prominentFace.x + prominentFace.width / 2;

  // Use actual video width if available, otherwise fall back to estimation
  let videoWidth: number;
  if (videoDimensions?.width) {
    videoWidth = videoDimensions.width;
  } else {
    // Fallback estimation based on video orientation
    const isVertical =
      videoDimensions?.orientation === 'portrait' ||
      (videoDimensions?.width && videoDimensions?.height && videoDimensions.width < videoDimensions.height);

    if (isVertical) {
      videoWidth = Math.max(
        faceCenterX * 1.3,
        prominentFace.x + prominentFace.width * 3,
        1080 // Common vertical video width
      );
    } else {
      videoWidth = Math.max(
        faceCenterX * 1.2,
        prominentFace.x + prominentFace.width * 4,
        1920 // Common horizontal video width
      );
    }
  }

  const faceCenterRatio = faceCenterX / videoWidth;

  // Convert face position to leftPosition scale
  // leftPosition: 0 = leftmost, 1 = center, 2 = rightmost
  // Use continuous mapping: faceCenterRatio * 2
  return Math.max(0, Math.min(2, faceCenterRatio * 2));
};

const getFramingTypes = (shotType: (typeof SHOT_TYPE)[keyof typeof SHOT_TYPE]) => {
  if (shotType === SHOT_TYPE.WIDE) {
    return [FRAMING_CATEGORIES.WIDE_SHOT, FRAMING_CATEGORIES.MEDIUM_LONG_SHOT, FRAMING_CATEGORIES.EXTREME_LONG_SHOT];
  } else if (shotType === SHOT_TYPE.MEDIUM) {
    return [FRAMING_CATEGORIES.MEDIUM_SHOT, FRAMING_CATEGORIES.MEDIUM_LONG_SHOT];
  } else if (shotType === SHOT_TYPE.CLOSE_UP) {
    return [FRAMING_CATEGORIES.EXTREME_CLOSE_UP, FRAMING_CATEGORIES.CLOSE_UP, FRAMING_CATEGORIES.MEDIUM_CLOSE_UP];
  }
  return [];
};

export const searchVideoEmbeddingsV2 = async (
  query: string,
  limit: number = 5,
  privateLibraryIds?: string[],
  excludeIds?: string[],
  metadataFilters?: {
    framing?: string;
    cameraAngle?: string;
    perspective?: string;
    depthOfField?: string;
    complexity?: string;
    arollBroll?: string;
    focusPosition?: string;
    clusterId?: string;
  },
  isAllPublicLibrariesSelected: boolean = false,
  includeVectorInOutput: boolean = false,
  onlyBroll: boolean = false
): Promise<Alternative[]> => {
  const queryEmbedding = await createTextEmbeddings(query);

  const filter: {
    $or?: (
      | { libraryId?: { $in: ObjectId[] }; isPublic?: boolean }
      | { arollBroll?: string; arollBrollHeuristic?: string }
    )[];
    _id?: { $nin: ObjectId[] };
    libraryId?: { $in: ObjectId[] };
    arollBroll?: string;
    arollBrollHeuristic?: string;
    isDeleted?: { $ne: boolean };
    framing?: string;
    cameraAngle?: string;
    perspective?: string;
    depthOfField?: string;
    complexity?: string;
    focusPosition?: string;
    clusterId?: number;
    $and?: any[];
  } = {
    isDeleted: { $ne: true }
  };

  if (privateLibraryIds && privateLibraryIds.length > 0) {
    filter.libraryId = { $in: privateLibraryIds.map(id => new ObjectId(id)) };
  }
  if (isAllPublicLibrariesSelected) {
    filter.$or = [{ libraryId: filter.libraryId }, { isPublic: true }];
    delete filter.libraryId;
  }
  if (excludeIds && excludeIds.length > 0) {
    filter._id = { $nin: excludeIds.map(id => new ObjectId(id)) };
  }

  // Add metadata filters if provided
  if (metadataFilters) {
    if (metadataFilters.framing) filter.framing = metadataFilters.framing;
    if (metadataFilters.cameraAngle) filter.cameraAngle = metadataFilters.cameraAngle;
    if (metadataFilters.perspective) filter.perspective = metadataFilters.perspective;
    if (metadataFilters.depthOfField) filter.depthOfField = metadataFilters.depthOfField;
    if (metadataFilters.complexity) filter.complexity = metadataFilters.complexity;
    if (metadataFilters.arollBroll) filter.arollBroll = metadataFilters.arollBroll;
    if (metadataFilters.focusPosition) filter.focusPosition = metadataFilters.focusPosition;
    if (metadataFilters.clusterId) filter.clusterId = parseInt(metadataFilters.clusterId);
  }


  const project: any = {
    title: 1,
    duration: 1,
    thumbnailUrl: 1,
    url: 1,
    isVertical: 1,
    complexity: 1,
    framing: 1,
    depthOfField: 1,
    perspective: 1,
    cameraAngle: 1,
    arollBroll: 1,
    arollBrollHeuristic: 1,
    focusPosition: 1,
    faceDetectionResults: 1,
    videoDimensions: 1,
    perceptualHash: 1,
    preview: 1,
    backgroundMotionScore: 1,
    mouthMovementScores: 1,
    _id: 1,
    score: {
      $meta: 'vectorSearchScore'
    }
  };

  if (includeVectorInOutput) {
    project.videoEmbedding = 1;
  }

  // WHEN ADDING TO VECTOR SEARCH FILTER QUERY, REMEMBER TO ADD THE FILTER TO THE INDEX IN MONGODB ATLAS
  const aggregationPipeline: any[] = [
    {
      $vectorSearch: {
        index: ENVIRONMENT === 'test' ? 'video_embedding_test' : 'vector_index',
        limit: onlyBroll ? limit * 2 : limit, // Fetch more candidates if we need to post-filter
        filter,
        // @ts-ignore
        // exact: true,
        numCandidates: 125,
        path: 'videoEmbedding',
        queryVector: queryEmbedding[0].textEmbedding
      }
    }
  ];

  aggregationPipeline.push({
    $project: project
  });

  const brollFootageMetadata = await BrollFootageMetadata.aggregate(aggregationPipeline);

  return brollFootageMetadata.map(broll => ({
    title: broll.title,
    duration: broll.duration,
    thumbnailUrl: broll.thumbnailUrl,
    link: broll.url,
    score: broll.score,
    isVisible: true,
    leftPosition: calculateLeftPositionFromFaces(broll.faceDetectionResults, broll.videoDimensions),
    topPosition: 1,
    offsetStart: 0,
    isVertical: broll.isVertical,
    complexity: broll.complexity,
    framing: broll.framing,
    depthOfField: broll.depthOfField,
    perspective: broll.perspective,
    cameraAngle: broll.cameraAngle,
    arollBroll: broll.arollBroll,
    focusPosition: broll.focusPosition,
    faceDetectionResults: broll.faceDetectionResults,
    videoDimensions: broll.videoDimensions,
    perceptualHash: broll.perceptualHash,
    videoEmbedding: includeVectorInOutput ? broll.videoEmbedding : undefined,
    id: -1,
    dbId: broll._id.toString(),
    type: 'pinecone',
    preview: broll.preview ?? broll.url
  }));
};
/**
 * Search for 100 public videos in MongoDB whose vectors are at least 70% similar to the search term,
 * group by libraryId, and return the unique libraryIds.
 */
export const searchMongoVideoEmbeddingsByLibrary = async (query: string): Promise<string[]> => {
  const queryEmbedding = await createTextEmbeddings(query);

  // Always filter by isPublic: true
  const filter: any = {
    isPublic: true,
    arollBroll: { $ne: AROLL_BROLL_CATEGORIES.AROLL },
    isDeleted: { $ne: true }
  };

  // MongoDB $vectorSearch + $match + $group
  const results = await BrollFootageMetadata.aggregate([
    {
      $vectorSearch: {
        index: 'vector_index',
        limit: 100,
        filter,
        numCandidates: 125,
        path: 'videoEmbedding',
        queryVector: queryEmbedding[0].textEmbedding
      }
    },
    {
      $project: {
        libraryId: 1,
        _id: 1,
        score: {
          $meta: 'vectorSearchScore'
        }
      }
    },

    // Only keep results with similarity >= 0.7
    { $match: { score: { $gte: 0.5 } } },
    // Group by libraryId and count the number of results per library
    { $group: { _id: '$libraryId', count: { $sum: 1 } } },
    // Project only the libraryId and count
    { $project: { libraryId: '$_id', count: 1, _id: 0 } },
    // Sort by count descending
    { $sort: { count: -1 } }
  ]);

  // Extract libraryId values
  return results.map((doc: any) => doc.libraryId?.toString()).filter(Boolean);
};

export type ClusterInfo = {
  topMatch: {
    id: ObjectId;
    title: string;
    url: string;
  };
  clusterId: number;
  documentsInCluster: number;
};
export const searchClustersByQuery = async (
  query: string,
  limit: number = 5,
  privateLibraryIds?: string[]
): Promise<ClusterInfo[]> => {
  try {
    const queryEmbedding = await createTextEmbeddings(query);
    const filter: any = {
      isDeleted: { $ne: true }
    };
    if (privateLibraryIds && privateLibraryIds.length > 0) {
      filter.libraryId = { $in: privateLibraryIds.map(id => new ObjectId(id)) };
    }

    const results = await BrollFootageMetadata.aggregate([
      // Stage 1: Vector search stage (requires Atlas Vector Search index)
      {
        $vectorSearch: {
          index: ENVIRONMENT === 'test' ? 'video_embedding_test' : 'vector_index',
          limit: 100,
          filter,
          // @ts-ignore
          // exact: true,
          numCandidates: 125,
          path: 'videoEmbedding',
          queryVector: queryEmbedding[0].textEmbedding
        }
      },

      // Stage 2: Group by clusterId
      {
        $group: {
          _id: '$clusterId',
          topScore: { $first: '$vectorSearchScore' },
          topMatch: { $first: '$$ROOT' },
          documentCount: { $sum: 1 }
          // avgScore: { $avg: '$similarityScore' }
        }
      },

      // Stage 3: Sort by score
      {
        $sort: { topScore: -1 }
      },

      {
        $limit: limit
      },

      // Stage 5: Project results
      {
        $project: {
          clusterId: '$_id',
          documentsInCluster: '$documentCount',
          topMatch: {
            id: '$topMatch._id',
            title: '$topMatch.title',
            url: '$topMatch.url'
          },
          _id: 0
        }
      }
    ]);
    return results;
  } catch (error) {
    logger.error('Error in getTop5ClustersWithVectorSearch:', error);
    throw error;
  }
};

export const similaritySearchV1 = async (
  vector: number[],
  limit: number = 5,
  privateLibraryIds?: string[],
  excludeIds?: string[],
  metadataFilters?: {
    framing?: string;
    cameraAngle?: string;
    perspective?: string;
    depthOfField?: string;
    complexity?: string;
    arollBroll?: string;
    focusPosition?: string;
    clusterId?: string;
  },
  isAllPublicLibrariesSelected: boolean = false
): Promise<Alternative[]> => {
  const filter: {
    $or?: { libraryId?: { $in: ObjectId[] }; isPublic?: boolean }[];
    _id?: { $nin: ObjectId[] };
    libraryId?: { $in: ObjectId[] };
    arollBroll?: string;
    isDeleted?: { $ne: boolean };
    framing?: string;
    cameraAngle?: string;
    perspective?: string;
    depthOfField?: string;
    complexity?: string;
    focusPosition?: string;
    clusterId?: number;
  } = {
    isDeleted: { $ne: true }
  };

  if (privateLibraryIds && privateLibraryIds.length > 0) {
    filter.libraryId = { $in: privateLibraryIds.map(id => new ObjectId(id)) };
  }
  if (isAllPublicLibrariesSelected) {
    filter.$or = [{ libraryId: filter.libraryId }, { isPublic: true }];
    delete filter.libraryId;
  }
  if (excludeIds && excludeIds.length > 0) {
    filter._id = { $nin: excludeIds.map(id => new ObjectId(id)) };
  }

  // Add metadata filters if provided
  if (metadataFilters) {
    if (metadataFilters.framing) filter.framing = metadataFilters.framing;
    if (metadataFilters.cameraAngle) filter.cameraAngle = metadataFilters.cameraAngle;
    if (metadataFilters.perspective) filter.perspective = metadataFilters.perspective;
    if (metadataFilters.depthOfField) filter.depthOfField = metadataFilters.depthOfField;
    if (metadataFilters.complexity) filter.complexity = metadataFilters.complexity;
    if (metadataFilters.arollBroll) filter.arollBroll = metadataFilters.arollBroll;
    if (metadataFilters.focusPosition) filter.focusPosition = metadataFilters.focusPosition;
    if (metadataFilters.clusterId) filter.clusterId = parseInt(metadataFilters.clusterId);
  }

  // WHEN ADDING TO VECTOR SEARCH FILTER QUERY, REMEMBER TO ADD THE FILTER TO THE INDEX IN MONGODB ATLAS
  const brollFootageMetadata = await BrollFootageMetadata.aggregate([
    {
      $vectorSearch: {
        index: ENVIRONMENT === 'test' ? 'video_embedding_test' : 'vector_index',
        limit,
        filter,
        // @ts-ignore
        // exact: true,
        numCandidates: 125,
        path: 'videoEmbedding',
        queryVector: vector
      }
    },
    {
      $project: {
        title: 1,
        duration: 1,
        thumbnailUrl: 1,
        url: 1,
        isVertical: 1,
        complexity: 1,
        framing: 1,
        depthOfField: 1,
        perspective: 1,
        cameraAngle: 1,
        arollBroll: 1,
        focusPosition: 1,
        faceDetectionResults: 1,
        videoDimensions: 1,
        perceptualHash: 1,
        preview: 1,
        _id: 1,
        score: {
          $meta: 'vectorSearchScore'
        }
      }
    }
  ]);

  return brollFootageMetadata.map(broll => ({
    title: broll.title,
    duration: broll.duration,
    thumbnailUrl: broll.thumbnailUrl,
    link: broll.url,
    score: broll.score,
    isVisible: true,
    leftPosition: calculateLeftPositionFromFaces(broll.faceDetectionResults, broll.videoDimensions),
    topPosition: 1,
    offsetStart: 0,
    isVertical: broll.isVertical,
    complexity: broll.complexity,
    framing: broll.framing,
    depthOfField: broll.depthOfField,
    perspective: broll.perspective,
    cameraAngle: broll.cameraAngle,
    arollBroll: broll.arollBroll,
    focusPosition: broll.focusPosition,
    faceDetectionResults: broll.faceDetectionResults,
    videoDimensions: broll.videoDimensions,
    perceptualHash: broll.perceptualHash,
    id: -1,
    dbId: broll._id.toString(),
    type: 'pinecone',
    preview: broll.preview ?? broll.url
  }));
};
