import libraryRepository from '../repositories/library.repository';
import { BrollFootageMetadata } from '../models/broll-video-metadata';
import { IBrollFootageMetadata, ILibrary } from '../types';
import { Types } from 'mongoose';
import { logger } from '../services/logging';

export interface VideoSample {
  id: string;
  description: string;
  clusterId?: number;
  totalClusterVideos?: number;
}

export interface SamplingResult {
  videos: VideoSample[];
  strategy: 'random' | 'clustered' | 'category-spread';
  totalVideos: number;
  sampledCount: number;
  clusterInfo?: {
    totalClusters: number;
    sampledClusters: number;
  };
}

export interface SamplingOptions {
  maxSamples?: number;
  minSamplesPerCluster?: number;
  maxSamplesPerCluster?: number;
  diversityWeight?: number; // 0-1, higher means more diversity over cluster size
}

export class LibraryVideoSamplingService {
  private static readonly DEFAULT_MAX_SAMPLES = 25;
  private static readonly DEFAULT_MIN_SAMPLES_PER_CLUSTER = 1;
  private static readonly DEFAULT_MAX_SAMPLES_PER_CLUSTER = 3;
  private static readonly CLUSTERING_THRESHOLD = 100;
  private static readonly SMALL_LIBRARY_SAMPLES = { min: 20, max: 30 };

  /**
   * Main entry point: Sample videos from library based on intelligent strategy
   */
  async sampleVideosFromLibrary(libraryId: string, options: SamplingOptions = {}): Promise<SamplingResult> {
    const {
      maxSamples = LibraryVideoSamplingService.DEFAULT_MAX_SAMPLES,
      minSamplesPerCluster = LibraryVideoSamplingService.DEFAULT_MIN_SAMPLES_PER_CLUSTER,
      maxSamplesPerCluster = LibraryVideoSamplingService.DEFAULT_MAX_SAMPLES_PER_CLUSTER,
      diversityWeight = 0.7
    } = options;

    // Get library and basic video count
    const library = await libraryRepository.findById(libraryId);
    if (!library) {
      throw new Error(`Library ${libraryId} not found`);
    }

    const totalVideos = await this.getVideoCount(libraryId);

    if (totalVideos === 0) {
      return {
        videos: [],
        strategy: 'random',
        totalVideos: 0,
        sampledCount: 0
      };
    }

    // Determine sampling strategy based on library size and clustering
    if (totalVideos < LibraryVideoSamplingService.CLUSTERING_THRESHOLD) {
      return await this.sampleSmallLibrary(libraryId, totalVideos, maxSamples);
    }

    // Large library - check if clustering is available
    const clusteringMetadata = library.clusteringMetadata;
    if (clusteringMetadata && clusteringMetadata.totalClusters > 0) {
      return await this.sampleClusteredLibrary(
        libraryId,
        totalVideos,
        clusteringMetadata,
        maxSamples,
        minSamplesPerCluster,
        maxSamplesPerCluster,
        diversityWeight
      );
    } else {
      return await this.sampleLargeUnclusteredLibrary(libraryId, totalVideos, maxSamples);
    }
  }

  /**
   * Sample from small library (< 100 videos) - random sampling
   */
  private async sampleSmallLibrary(
    libraryId: string,
    totalVideos: number,
    maxSamples: number
  ): Promise<SamplingResult> {
    const sampleCount = Math.min(
      Math.min(totalVideos, maxSamples),
      Math.max(
        LibraryVideoSamplingService.SMALL_LIBRARY_SAMPLES.min,
        Math.min(LibraryVideoSamplingService.SMALL_LIBRARY_SAMPLES.max, totalVideos)
      )
    );

    const videos = await this.getRandomVideos(libraryId, sampleCount);

    return {
      videos: videos.map(this.videoToSample),
      strategy: 'random',
      totalVideos,
      sampledCount: videos.length
    };
  }

  /**
   * Sample from clustered library using intelligent cluster-based sampling
   */
  private async sampleClusteredLibrary(
    libraryId: string,
    totalVideos: number,
    clusteringMetadata: any,
    maxSamples: number,
    minSamplesPerCluster: number,
    maxSamplesPerCluster: number,
    diversityWeight: number
  ): Promise<SamplingResult> {
    const { totalClusters, clusterStats } = clusteringMetadata;
    if (!clusterStats || clusterStats.length === 0) {
      // Fallback to unclustered sampling
      return await this.sampleLargeUnclusteredLibrary(libraryId, totalVideos, maxSamples);
    }

    // Take at most 10 random clusters
    const randomizedClusters = clusterStats.sort(() => Math.random() - 0.5); // Randomize order

    const allSampledVideos: VideoSample[] = [];
    let sampledClusters = 0;

    for (const cluster of randomizedClusters) {
      const clusterVideos = await this.getVideosFromCluster(libraryId, cluster.clusterId, 3);

      const sampledClusterVideos = clusterVideos.map(video => ({
        ...this.videoToSample(video),
        totalClusterVideos: cluster.videoCount,
        clusterId: cluster.clusterId
      }));

      allSampledVideos.push(...sampledClusterVideos);
      sampledClusters++;
    }

    return {
      videos: allSampledVideos,
      strategy: 'clustered',
      totalVideos,
      sampledCount: allSampledVideos.length,
      clusterInfo: {
        totalClusters,
        sampledClusters
      }
    };
  }

  /**
   * Sample from large unclustered library - category spread sampling
   */
  private async sampleLargeUnclusteredLibrary(
    libraryId: string,
    totalVideos: number,
    maxSamples: number
  ): Promise<SamplingResult> {
    // Try to sample with diversity across different tags/categories
    const videos = await this.getVideosWithCategorySpread(libraryId, maxSamples);

    return {
      videos: videos.map(this.videoToSample),
      strategy: 'category-spread',
      totalVideos,
      sampledCount: videos.length
    };
  }

  /**
   * Calculate optimal samples per cluster using weighted distribution
   */
  private calculateClusterSamples(
    clusters: any[],
    maxSamples: number,
    minSamplesPerCluster: number,
    maxSamplesPerCluster: number,
    diversityWeight: number
  ): Record<number, number> {
    const result: Record<number, number> = {};

    // Calculate total videos across all clusters
    const totalClusterVideos = clusters.reduce((sum, cluster) => sum + cluster.videoCount, 0);

    // First pass: ensure minimum samples for each cluster (up to maxSamples)
    let remainingSamples = maxSamples;
    const eligibleClusters = clusters.filter(c => c.videoCount > 0);

    // Apply minimum samples
    for (const cluster of eligibleClusters) {
      if (remainingSamples <= 0) break;
      const minSamples = Math.min(minSamplesPerCluster, cluster.videoCount, remainingSamples);
      result[cluster.clusterId] = minSamples;
      remainingSamples -= minSamples;
    }

    // Second pass: distribute remaining samples based on cluster size and diversity
    while (remainingSamples > 0) {
      let allocated = false;

      for (const cluster of eligibleClusters) {
        if (remainingSamples <= 0) break;

        const currentSamples = result[cluster.clusterId] || 0;
        if (currentSamples >= maxSamplesPerCluster) continue;

        // Calculate allocation weight: balance between cluster size and diversity
        const sizeWeight = cluster.videoCount / totalClusterVideos;
        const diversityFactor = 1 / eligibleClusters.length; // Equal representation factor
        const finalWeight = (1 - diversityWeight) * sizeWeight + diversityWeight * diversityFactor;

        // Allocate based on weight (simplified: allocate if cluster is above average weight)
        const avgWeight = 1 / eligibleClusters.length;
        if (finalWeight >= avgWeight * 0.8) {
          // 80% of average to allow some flexibility
          result[cluster.clusterId] = currentSamples + 1;
          remainingSamples--;
          allocated = true;
        }
      }

      // If no allocation happened, break to avoid infinite loop
      if (!allocated) break;
    }

    return result;
  }

  /**
   * Get random videos from library
   */
  private async getRandomVideos(libraryId: string, count: number): Promise<IBrollFootageMetadata[]> {
    return await BrollFootageMetadata.aggregate([
      {
        $match: {
          libraryId: new Types.ObjectId(libraryId),
          isDeleted: { $ne: true },
          status: 'PROCESSED'
        }
      },
      { $sample: { size: count } }
    ]);
  }

  /**
   * Get videos from specific cluster
   */
  private async getVideosFromCluster(
    libraryId: string,
    clusterId: number,
    count: number
  ): Promise<IBrollFootageMetadata[]> {
    return await BrollFootageMetadata.aggregate([
      {
        $match: {
          libraryId: new Types.ObjectId(libraryId),
          clusterId: clusterId,
          isDeleted: { $ne: true }
        }
      },
      { $sample: { size: count } }
    ]);
  }

  /**
   * Get videos with category spread for unclustered libraries
   */
  private async getVideosWithCategorySpread(libraryId: string, maxSamples: number): Promise<IBrollFootageMetadata[]> {
    // First, get unique tags/categories
    const tagAggregation = await BrollFootageMetadata.aggregate([
      {
        $match: {
          libraryId: new Types.ObjectId(libraryId),
          isDeleted: { $ne: true },
          status: 'PROCESSED',
          tag: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$tag',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 } // Top 10 categories
    ]);

    if (tagAggregation.length === 0) {
      // No tags available, fall back to random sampling
      return await this.getRandomVideos(libraryId, maxSamples);
    }

    // Sample videos from each category
    const samplesPerCategory = Math.max(1, Math.floor(maxSamples / tagAggregation.length));
    const extraSamples = maxSamples % tagAggregation.length;

    const allVideos: IBrollFootageMetadata[] = [];

    for (let i = 0; i < tagAggregation.length && allVideos.length < maxSamples; i++) {
      const tag = tagAggregation[i]._id;
      const samplesToTake = samplesPerCategory + (i < extraSamples ? 1 : 0);

      const categoryVideos = await BrollFootageMetadata.aggregate([
        {
          $match: {
            libraryId: new Types.ObjectId(libraryId),
            tag: tag,
            isDeleted: { $ne: true },
            status: 'PROCESSED'
          }
        },
        { $sample: { size: samplesToTake } }
      ]);

      allVideos.push(...categoryVideos);
    }

    return allVideos.slice(0, maxSamples);
  }

  /**
   * Get total video count for a library
   */
  private async getVideoCount(libraryId: string): Promise<number> {
    return await libraryRepository.countBrollByLibraryId(libraryId);
  }

  /**
   * Convert BrollFootageMetadata to VideoSample
   */
  private videoToSample(video: IBrollFootageMetadata): VideoSample {
    return {
      id: video._id?.toString() || '',
      description: video.title || 'Untitled Video'
    };
  }
}

export const libraryVideoSamplingService = new LibraryVideoSamplingService();
