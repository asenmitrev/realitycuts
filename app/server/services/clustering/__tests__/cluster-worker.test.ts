import { Worker } from 'node:worker_threads';
import { describe, expect, it } from 'vitest';
import {
	buildClusterWorkerScript,
	type ClusterComputeInput,
	type ClusterComputeOutput,
	runClusterCompute,
	runClusterComputeInWorker
} from '../cluster-worker';

/**
 * Two well-separated groups of 4 points each in 8-D space, with a little
 * per-point jitter. Contiguous blocks (all A, then all B) so a correct run
 * must yield `assignments = [0,0,0,0,1,1,1,1]` (or the mirror). The shuffled
 * fit-sample ordering that used to leak into the output made this exact
 * expectation fail, so it doubles as a regression test for the
 * fit-order-vs-row-order permutation bug.
 */
function makeTwoClusterEmbeddings(): number[][] {
	const jitter = (i: number) => (((i * 37) % 7) - 3) / 100;
	const out: number[][] = [];
	for (let i = 0; i < 4; i++) {
		out.push([1 + (jitter(i) || 0), 0, 0, 0, 0, 0, 0, 0]);
	}
	for (let i = 0; i < 4; i++) {
		out.push([0, 0, 0, 0, 0, 1 + (jitter(i) || 0), 0, 0]);
	}
	return out;
}

function toFlatInput(embeddings: number[], dim: number, overrides: Partial<ClusterComputeInput> = {}): ClusterComputeInput {
	const flat = new Float64Array(embeddings.length * dim);
	for (let i = 0; i < embeddings.length; i++) {
		flat.set(embeddings[i], i * dim);
	}
	return {
		flatEmbeddings: flat,
		sourceDim: dim,
		targetDim: 4,
		maxFitSample: 1000,
		maxIterations: 25,
		kCandidateSpread: 1,
		...overrides
	};
}

function runScriptInWorker(script: string, workerData: ClusterComputeInput): Promise<{ ok: boolean; result?: ClusterComputeOutput; error?: string }> {
	return new Promise((resolve, reject) => {
		const worker = new Worker(script, { eval: true, workerData });
		worker.once('message', message => {
			void worker.terminate();
			resolve(message);
		});
		worker.once('error', error => {
			void worker.terminate();
			reject(error);
		});
	});
}

describe('runClusterCompute (in-process)', () => {
	it('separates two well-separated groups into distinct clusters', () => {
		const embeddings = makeTwoClusterEmbeddings();
		const { k, assignments } = runClusterCompute(toFlatInput(embeddings, 8));
		expect(assignments.length).toBe(embeddings.length);
		expect(assignments.every(a => a >= 0 && a < k)).toBe(true);

		const firstHalf = new Set(assignments.slice(0, 4));
		const secondHalf = new Set(assignments.slice(4, 8));
		expect(firstHalf.size).toBe(1);
		expect(secondHalf.size).toBe(1);
		expect(firstHalf.values().next().value).not.toBe(secondHalf.values().next().value);
	});

	it('is deterministic for the same input', () => {
		const input = toFlatInput(makeTwoClusterEmbeddings(), 8);
		expect(runClusterCompute(input)).toEqual(runClusterCompute(input));
	});

	it('handles empty input', () => {
		expect(runClusterCompute(toFlatInput([], 8))).toEqual({ k: 0, assignments: [] });
	});
});

describe('runClusterComputeInWorker (non-minified source, dev path)', () => {
	it('runs the compute in a worker thread and returns a valid result', async () => {
		const embeddings = makeTwoClusterEmbeddings();
		const { k, assignments } = await runClusterComputeInWorker(embeddings, {
			targetDim: 4,
			maxFitSample: 1000,
			maxIterations: 25,
			kCandidateSpread: 1
		});
		expect(assignments.length).toBe(embeddings.length);
		expect(k).toBeGreaterThanOrEqual(2);
	});
});

describe('buildClusterWorkerScript (minified prod-bundle simulation)', () => {
	// Re-runs esbuild exactly the way build.js does for the server bundle
	// (minify + keepNames), then lifts the minified function out of the
	// transformed code the same way `runClusterCompute.toString()` sees it in
	// the real bundle. Regression guard for the "a is not defined" failure:
	// keepNames renames esbuild's `__name` helper to an arbitrary short
	// identifier (e.g. `a`) and the lifted function's body calls it; the
	// worker script must shim that exact identifier or the worker throws a
	// ReferenceError.
	async function liftedMinifiedSource(): Promise<{ source: string; helperName: string }> {
		const { transform } = await import('esbuild');
		const { code } = await transform(runClusterCompute.toString(), {
			minify: true,
			keepNames: true,
			format: 'cjs',
			target: 'node20'
		});
		// keepNames appends `<helperCall>(<fnName>, "runClusterCompute")` after
		// the declaration — the only call with that string-literal argument.
		const helperCall = code.match(/\b([A-Za-z_$][\w$]*)\(\s*([A-Za-z_$][\w$]*)\s*,\s*"runClusterCompute"\s*\)/);
		if (!helperCall) throw new Error('expected keepNames to emit a helper call for the function');
		const [, helperName, fnName] = helperCall;

		const declStart = code.indexOf(`function ${fnName}(`);
		if (declStart < 0) throw new Error('expected the function declaration to survive minification');
		const bodyStart = code.indexOf('{', declStart);
		let depth = 0;
		let end = bodyStart;
		for (; end < code.length; end++) {
			if (code[end] === '{') depth++;
			else if (code[end] === '}') {
				depth--;
				if (depth === 0) break;
			}
		}
		const source = code.slice(declStart, end + 1);
		return { source, helperName };
	}

	it('shims the renamed keepNames helper so the script is self-contained', async () => {
		const { source, helperName } = await liftedMinifiedSource();
		// Sanity: the lifted source really does reference the bundle-scope
		// helper — without this, the test below couldn't catch the regression.
		expect(source).toContain(`${helperName}(`);
		expect(new RegExp(`\\bfunction\\s+${helperName}\\b`).test(source)).toBe(false);

		const script = buildClusterWorkerScript(source);
		expect(script).toContain(`function ${helperName}(target, value) { __name(target, value); }`);

		const message = await runScriptInWorker(script, toFlatInput(makeTwoClusterEmbeddings(), 8));
		expect(message).toEqual(
			expect.objectContaining({
				ok: true,
				result: expect.objectContaining({ k: expect.any(Number), assignments: expect.any(Array) })
			})
		);
		if (message.ok && message.result) {
			expect(message.result.assignments.length).toBe(8);
		}
	});

	it('still works for a plain (non-minified) function source', async () => {
		const script = buildClusterWorkerScript(runClusterCompute.toString());
		const message = await runScriptInWorker(script, toFlatInput(makeTwoClusterEmbeddings(), 8));
		expect(message.ok).toBe(true);
	});
});
