/**
 * Groups a library's broll footage by video-embedding similarity.
 *
 * TS re-implementation of the deleted `functions/library-clustering-lambda`
 * (UMAP + HDBSCAN + BERTopic, run as a Python Lambda triggered off SQS).
 * That pipeline's iterative hyperparameter search maximized a
 * silhouette/topic-coherence/distinctiveness/balance score across up to 10
 * rounds; here we run k-means over a handful of candidate k values and pick
 * the one with the best silhouette score. The actual math runs in a worker
 * thread (see `services/clustering/cluster-worker.ts`) — it's CPU-bound and
 * this process also serves HTTP requests and every other BullMQ queue.
 */

import libraryRepository from '../repositories/library.repository';
import brollRepository from '../repositories/broll.repository';
import { logger } from './logging';
import { runClusterComputeInWorker } from './clustering/cluster-worker';
import { extractClusterKeywords } from './clustering/keywords';
import type { ClusterStats } from '../types';

// Exported so the manual "cluster now" trigger (library.service.ts) can give an
// immediate, specific error instead of silently enqueueing a job that will just
// skip once it runs.
export const MIN_BROLL_COUNT = 100;

// How soon a library can be re-clustered after its last run. Guards against a
// user mashing a "cluster now" button and pegging the worker thread on repeat —
// BullMQ's own jobId dedupe (see task-queue.ts) only prevents *concurrent*
// duplicates, not back-to-back reruns once each one finishes.
export const RECLUSTER_COOLDOWN_MS = 2 * 60 * 1000;

const PROJECTED_DIMENSIONS = 64;

// Both the k-means effort and the amount of data it's fit on scale down as
// library size grows, mirroring the original Lambda's own `max_iter`
// reduction for libraries over 4,000 / 7,000 embeddings — this bounds how
// long a single clustering run can occupy the worker thread.
const EFFORT_TIERS = [
  { minSize: 10_000, maxIterations: 10, kCandidateSpread: 0 },
  { minSize: 4_000, maxIterations: 15, kCandidateSpread: 1 },
  { minSize: 0, maxIterations: 25, kCandidateSpread: 1 },
];

// Above this many embedded broll, k-means is *fit* on a random sample this size
// (bounding both memory and O(n) fit cost); every item is still assigned a
// cluster afterward via a cheap nearest-centroid pass.
const MAX_FIT_SAMPLE = 20_000;

export type ClusteringResult = {
  libraryId: string;
  numClusters: number;
  totalRecords: number;
  message?: string;
};

function effortForSize(n: number) {
  return EFFORT_TIERS.find(tier => n >= tier.minSize)!;
}

/**
 * Runs clustering for a single library and persists the results. Safe to call
 * repeatedly — each run fully replaces the previous cluster assignments.
 */
export async function processLibraryClustering(libraryId: string): Promise<ClusteringResult> {
  const brolls = await brollRepository.findEmbeddingsForClustering(libraryId);

  if (brolls.length === 0) {
    return { libraryId, numClusters: 0, totalRecords: 0, message: 'No records with embeddings found' };
  }

  if (brolls.length < MIN_BROLL_COUNT) {
    logger.info('Skipping clustering — not enough embedded broll yet', {
      libraryId,
      count: brolls.length,
      minRequired: MIN_BROLL_COUNT
    });
    return {
      libraryId,
      numClusters: 0,
      totalRecords: brolls.length,
      message: `Fewer than ${MIN_BROLL_COUNT} records with embeddings found`
    };
  }

  const ids = brolls.map(b => String(b._id));
  const titles = brolls.map(b => b.title ?? '');
  const embeddings = brolls.map(b => b.videoEmbedding as number[]);

  const { maxIterations, kCandidateSpread } = effortForSize(embeddings.length);
  logger.info('Starting clustering', {
    libraryId,
    count: embeddings.length,
    maxIterations,
    fitSampleSize: Math.min(embeddings.length, MAX_FIT_SAMPLE)
  });

  const { k, assignments } = await runClusterComputeInWorker(embeddings, {
    targetDim: PROJECTED_DIMENSIONS,
    maxFitSample: MAX_FIT_SAMPLE,
    maxIterations,
    kCandidateSpread
  });

  const clusterTexts = new Map<number, string[]>();
  for (let i = 0; i < assignments.length; i++) {
    const cluster = assignments[i];
    if (!clusterTexts.has(cluster)) clusterTexts.set(cluster, []);
    clusterTexts.get(cluster)!.push(titles[i]);
  }
  const keywordsByCluster = extractClusterKeywords(clusterTexts);

  const clusterVersion = Math.floor(Date.now() / 1000);

  await brollRepository.bulkSetClusterAssignments(
    ids.map((id, i) => ({ id, clusterId: assignments[i] })),
    clusterVersion
  );

  const clusterStats: ClusterStats[] = [];
  for (let clusterId = 0; clusterId < k; clusterId++) {
    const memberIndices = assignments
      .map((cluster, index) => ({ cluster, index }))
      .filter(entry => entry.cluster === clusterId)
      .map(entry => entry.index);

    if (memberIndices.length === 0) continue;

    clusterStats.push({
      clusterId,
      videoCount: memberIndices.length,
      keywords: keywordsByCluster.get(clusterId) ?? [],
      sampleVideoIds: memberIndices.slice(0, 5).map(i => ids[i])
    });
  }

  await libraryRepository.updateClusteringMetadata(libraryId, {
    totalClusters: clusterStats.length,
    clusteringVersion: clusterVersion,
    clusteringDate: new Date(),
    clusterStats,
    totalClusteredVideos: ids.length,
    // Simplification vs. HDBSCAN: k-means assigns every point to a cluster, so there's no
    // density-based noise/outlier bucket here.
    noiseVideos: 0
  });

  logger.info('Clustering completed', { libraryId, numClusters: clusterStats.length, totalRecords: ids.length });

  return { libraryId, numClusters: clusterStats.length, totalRecords: ids.length };
}
