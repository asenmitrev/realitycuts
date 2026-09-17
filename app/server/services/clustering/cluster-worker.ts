/**
 * Runs the actual clustering math (random projection + k-means + silhouette-based
 * k selection) inside a worker_threads Worker, so a large library's CPU-bound
 * clustering pass never blocks the main Node event loop — the same process that
 * serves HTTP requests and every other BullMQ queue.
 *
 * The worker is spun up via `eval: true` with `runClusterCompute` embedded as
 * source text (`Function.prototype.toString()`), rather than as a separate
 * compiled entry point — that works identically under `tsx watch` (dev) and
 * under the single-file esbuild bundle (prod) with no extra build wiring.
 * Because of that, `runClusterCompute` must stay fully self-contained: no
 * imports from sibling project modules, only Node builtins and its own
 * nested helpers. It's still an ordinary exported function, so it can be
 * unit-tested directly (in-process, no worker) like any other pure function.
 *
 * Stands in for the original Python pipeline's UMAP + HDBSCAN combination:
 * UMAP's nonlinear reduction and HDBSCAN's density-based, noise-aware
 * clustering are both out of scope here. A seeded Gaussian random projection
 * plus k-means with silhouette-based k selection covers the same job (turn
 * embeddings into a handful of meaningful groups) without a second language
 * runtime or heavy ML deps. Trade-off: every point is assigned to a cluster —
 * there's no HDBSCAN-style noise/outlier bucket.
 */

import { Worker } from "node:worker_threads";

export type ClusterComputeInput = {
	flatEmbeddings: Float64Array;
	sourceDim: number;
	targetDim: number;
	maxFitSample: number;
	maxIterations: number;
	kCandidateSpread: number;
};

export type ClusterComputeOutput = {
	k: number;
	assignments: number[];
};

/**
 * Pure, synchronous, dependency-free clustering pipeline over a flattened
 * (row-major) embedding matrix. Never call this directly on the main thread
 * in production — use `runClusterComputeInWorker`, which runs this same
 * function inside a worker thread.
 */
export function runClusterCompute(input: ClusterComputeInput): ClusterComputeOutput {
	const { flatEmbeddings, sourceDim, targetDim, maxFitSample, maxIterations, kCandidateSpread } = input;
	const n = sourceDim > 0 ? flatEmbeddings.length / sourceDim : 0;
	const dim = Math.min(targetDim, sourceDim);

	function createRng(seed: number) {
		let a = seed >>> 0;
		return () => {
			a |= 0;
			a = (a + 0x6d2b79f5) | 0;
			let t = Math.imul(a ^ (a >>> 15), 1 | a);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	}

	function randomGaussian(rng: () => number): number {
		const u1 = Math.max(rng(), Number.EPSILON);
		const u2 = rng();
		return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
	}

	function squaredDistance(a: Float64Array, b: Float64Array): number {
		let sum = 0;
		for (let i = 0; i < a.length; i++) {
			const diff = a[i] - b[i];
			sum += diff * diff;
		}
		return sum;
	}

	// 1. Random (Johnson-Lindenstrauss) projection — cuts dimensionality (e.g. 1408 -> 64)
	// so k-means/silhouette scoring over a few thousand vectors stays cheap.
	function project(): Float64Array {
		if (dim >= sourceDim) return flatEmbeddings;
		const rng = createRng(42);
		const scale = 1 / Math.sqrt(dim);
		const matrix = new Float64Array(sourceDim * dim);
		for (let i = 0; i < matrix.length; i++) matrix[i] = randomGaussian(rng) * scale;

		const out = new Float64Array(n * dim);
		for (let row = 0; row < n; row++) {
			const srcOffset = row * sourceDim;
			const dstOffset = row * dim;
			for (let i = 0; i < sourceDim; i++) {
				const value = flatEmbeddings[srcOffset + i];
				if (value === 0) continue;
				const matRowOffset = i * dim;
				for (let j = 0; j < dim; j++) {
					out[dstOffset + j] += value * matrix[matRowOffset + j];
				}
			}
		}
		return out;
	}

	const projected = project();
	function pointAt(index: number): Float64Array {
		return projected.subarray(index * dim, (index + 1) * dim);
	}

	// 2. Bound how many points k-means is fit on (partial Fisher-Yates sample).
	function sampleIndices(sampleSize: number, seed: number): Int32Array {
		const rng = createRng(seed);
		const indices = new Int32Array(n);
		for (let i = 0; i < n; i++) indices[i] = i;
		const take = Math.min(n, sampleSize);
		for (let i = n - 1; i > n - 1 - take && i > 0; i--) {
			const j = Math.floor(rng() * (i + 1));
			const tmp = indices[i];
			indices[i] = indices[j];
			indices[j] = tmp;
		}
		return indices.subarray(n - take);
	}

	function assign(indices: Int32Array, centroids: Float64Array[]): Int32Array {
		const assignments = new Int32Array(indices.length);
		for (let i = 0; i < indices.length; i++) {
			const point = pointAt(indices[i]);
			let bestCluster = 0;
			let bestDistance = Infinity;
			for (let c = 0; c < centroids.length; c++) {
				const distance = squaredDistance(point, centroids[c]);
				if (distance < bestDistance) {
					bestDistance = distance;
					bestCluster = c;
				}
			}
			assignments[i] = bestCluster;
		}
		return assignments;
	}

	function kmeansPlusPlusInit(indices: Int32Array, k: number, rng: () => number): Float64Array[] {
		const centroids: Float64Array[] = [pointAt(indices[Math.floor(rng() * indices.length)]).slice()];
		while (centroids.length < k) {
			let total = 0;
			const distances = new Float64Array(indices.length);
			for (let i = 0; i < indices.length; i++) {
				const point = pointAt(indices[i]);
				let best = Infinity;
				for (const c of centroids) best = Math.min(best, squaredDistance(point, c));
				distances[i] = best;
				total += best;
			}
			if (total === 0) {
				centroids.push(pointAt(indices[Math.floor(rng() * indices.length)]).slice());
				continue;
			}
			let threshold = rng() * total;
			let chosen = indices.length - 1;
			for (let i = 0; i < distances.length; i++) {
				threshold -= distances[i];
				if (threshold <= 0) {
					chosen = i;
					break;
				}
			}
			centroids.push(pointAt(indices[chosen]).slice());
		}
		return centroids;
	}

	/** Lloyd's algorithm with k-means++ seeding, restricted to the given index subset. */
	function runKMeans(indices: Int32Array, k: number): { assignments: Int32Array; centroids: Float64Array[] } {
		const rng = createRng(42);
		let centroids = kmeansPlusPlusInit(indices, k, rng);
		let assignments = assign(indices, centroids);

		for (let iter = 1; iter < maxIterations; iter++) {
			const sums: Float64Array[] = Array.from({ length: k }, () => new Float64Array(dim));
			const counts = new Int32Array(k);
			for (let i = 0; i < indices.length; i++) {
				const cluster = assignments[i];
				counts[cluster]++;
				const point = pointAt(indices[i]);
				const sum = sums[cluster];
				for (let d = 0; d < dim; d++) sum[d] += point[d];
			}
			centroids = sums.map((sum, cluster) =>
				counts[cluster] > 0
					? sum.map(v => v / counts[cluster])
					: pointAt(indices[Math.floor(rng() * indices.length)]).slice(),
			);

			const nextAssignments = assign(indices, centroids);
			let changed = false;
			for (let i = 0; i < nextAssignments.length; i++) {
				if (nextAssignments[i] !== assignments[i]) {
					changed = true;
					break;
				}
			}
			assignments = nextAssignments;
			if (!changed) break;
		}

		return { assignments, centroids };
	}

	/** Mean silhouette coefficient over a capped random sample (silhouette is O(n^2)). */
	function silhouetteScore(indices: Int32Array, assignments: Int32Array, sampleSize = 800): number {
		const clusterCount = new Set(Array.from(assignments)).size;
		if (clusterCount < 2 || clusterCount >= indices.length) return -1;

		const rng = createRng(7);
		let sampled = Array.from({ length: indices.length }, (_, i) => i);
		if (sampled.length > sampleSize) {
			for (let i = sampled.length - 1; i > 0; i--) {
				const j = Math.floor(rng() * (i + 1));
				[sampled[i], sampled[j]] = [sampled[j], sampled[i]];
			}
			sampled = sampled.slice(0, sampleSize);
		}

		const byCluster = new Map<number, number[]>();
		for (const s of sampled) {
			const cluster = assignments[s];
			if (!byCluster.has(cluster)) byCluster.set(cluster, []);
			byCluster.get(cluster)!.push(s);
		}

		let total = 0;
		let count = 0;
		for (const s of sampled) {
			const ownCluster = assignments[s];
			const ownMembers = byCluster.get(ownCluster)!;
			if (ownMembers.length <= 1) continue;
			const point = pointAt(indices[s]);

			let intraSum = 0;
			for (const m of ownMembers) {
				if (m === s) continue;
				intraSum += Math.sqrt(squaredDistance(point, pointAt(indices[m])));
			}
			const a = intraSum / (ownMembers.length - 1);

			let b = Infinity;
			for (const [cluster, members] of byCluster) {
				if (cluster === ownCluster) continue;
				let interSum = 0;
				for (const m of members) interSum += Math.sqrt(squaredDistance(point, pointAt(indices[m])));
				b = Math.min(b, interSum / members.length);
			}
			if (b === Infinity) continue;
			total += (b - a) / Math.max(a, b);
			count++;
		}
		return count > 0 ? total / count : -1;
	}

	function candidateKValues(size: number, spread: number): number[] {
		const maxK = Math.min(15, Math.floor(size / 20));
		if (maxK < 2) return [2];
		// sqrt(n/2) is only a sane guess for smallish n — clamp into [2, maxK] so
		// it never collapses to the maxK<2 fallback for ordinary-sized libraries.
		const base = Math.min(maxK, Math.max(2, Math.round(Math.sqrt(size / 2))));
		const candidates = new Set<number>();
		for (let offset = -spread; offset <= spread; offset++) {
			const k = base + offset;
			if (k >= 2 && k <= maxK) candidates.add(k);
		}
		candidates.add(base);
		return Array.from(candidates);
	}

	if (n === 0) return { k: 0, assignments: [] };

	// 3. Fit k-means for a few candidate k values on the (possibly sampled) fit set,
	//    keep whichever scores best by silhouette.
	const fitIndices = sampleIndices(maxFitSample, 99);
	let best: { k: number; assignments: Int32Array; centroids: Float64Array[]; score: number } | null = null;
	for (const k of candidateKValues(fitIndices.length, kCandidateSpread)) {
		const { assignments, centroids } = runKMeans(fitIndices, k);
		const score = silhouetteScore(fitIndices, assignments);
		if (!best || score > best.score) best = { k, assignments, centroids, score };
	}
	const chosen = best!;

	// 4. Assign every point (not just the fit sample) to its nearest centroid.
	const allIndices = new Int32Array(n);
	for (let i = 0; i < n; i++) allIndices[i] = i;
	const allAssignments = fitIndices.length === n ? chosen.assignments : assign(allIndices, chosen.centroids);

	return { k: chosen.k, assignments: Array.from(allAssignments) };
}

type WorkerMessage =
	| { ok: true; result: ClusterComputeOutput }
	| { ok: false; error: string };

/**
 * Runs `runClusterCompute` inside a worker thread. Embeddings are transferred as
 * a single flat Float64Array (zero-copy) rather than cloned as nested arrays,
 * which matters once a library has tens of thousands of embedded videos.
 */
export function runClusterComputeInWorker(
	embeddings: number[][],
	options: { targetDim: number; maxFitSample: number; maxIterations: number; kCandidateSpread: number },
): Promise<ClusterComputeOutput> {
	const sourceDim = embeddings[0]?.length ?? 0;
	const flatEmbeddings = new Float64Array(embeddings.length * sourceDim);
	for (let i = 0; i < embeddings.length; i++) {
		flatEmbeddings.set(embeddings[i], i * sourceDim);
	}

	const workerData: ClusterComputeInput = {
		flatEmbeddings,
		sourceDim,
		targetDim: options.targetDim,
		maxFitSample: options.maxFitSample,
		maxIterations: options.maxIterations,
		kCandidateSpread: options.kCandidateSpread,
	};

	// `runClusterCompute` is embedded as source text so this works the same way
	// whether the caller is running under `tsx watch` or the bundled prod build —
	// see the module doc comment for why this can't be a separate worker file.
	// Both esbuild and tsx's transpiler can inline a `__name(fn, "fn")` helper
	// call into a function's body to preserve `Function.prototype.name`; that
	// helper isn't in scope once we lift just this one function out via
	// `toString()`, so it's shimmed here rather than depending on transpiler
	// output shape.
	const script = `
		const { parentPort, workerData } = require("node:worker_threads");
		function __name(target, value) {
			try { Object.defineProperty(target, "name", { value, configurable: true }); } catch {}
			return target;
		}
		const run = ${runClusterCompute.toString()};
		try {
			parentPort.postMessage({ ok: true, result: run(workerData) });
		} catch (error) {
			parentPort.postMessage({ ok: false, error: error && error.message ? error.message : String(error) });
		}
	`;

	return new Promise((resolve, reject) => {
		const worker = new Worker(script, {
			eval: true,
			workerData,
			transferList: [flatEmbeddings.buffer],
		});
		worker.once("message", (message: WorkerMessage) => {
			void worker.terminate();
			if (message.ok) resolve(message.result);
			else reject(new Error(message.error));
		});
		worker.once("error", error => {
			void worker.terminate();
			reject(error);
		});
	});
}
