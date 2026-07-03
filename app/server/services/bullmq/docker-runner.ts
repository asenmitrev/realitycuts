/**
 * Docker container runner — spawns a Docker container for a single job,
 * waits for completion, and returns structured results.
 *
 * Used by BullMQ workers to execute Docker-based tasks without porting
 * business logic to TypeScript.
 *
 * The container receives all input via environment variables. Stdout/stderr
 * are streamed to the BullMQ worker logger. On non-zero exit or timeout,
 * a DockerRunnerError is thrown so BullMQ can retry.
 */

import { execa, type Options } from "execa";
import type { ExecaChildProcess } from "execa";
import { logger } from "../logging";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DockerRunOptions {
	/** Full Docker image reference (e.g. ECR URI or local tag). */
	image: string;

	/** Environment variables to inject into the container. */
	env: Record<string, string>;

	/**
	 * Override the image's default CMD/ENTRYPOINT.
	 * Passed as a single shell string — Docker wraps it in `/bin/sh -c`.
	 */
	cmd?: string;

	/**
	 * Maximum execution time in milliseconds.
	 * @default 600_000 (10 minutes)
	 */
	timeout?: number;

	/**
	 * Additional Docker flags (e.g. `--gpus all`, `-v /tmp:/tmp`).
	 * Each entry is a separate argument.
	 */
	extraFlags?: string[];
}

export class DockerRunnerError extends Error {
	constructor(
		message: string,
		public readonly exitCode: number | null,
		public readonly stdout: string,
		public readonly stderr: string,
	) {
		super(message);
		this.name = "DockerRunnerError";
	}
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

/**
 * Execute a Docker container and wait for it to finish.
 *
 * @throws {DockerRunnerError} on non-zero exit code or timeout
 */
export async function runDockerContainer(options: DockerRunOptions): Promise<void> {
	const {
		image,
		env,
		cmd,
		timeout = 600_000, // 10 minutes default
		extraFlags = [],
	} = options;

	const containerLabel = `bullmq-${Date.now()}`;

	// Build the docker run command arguments
	const args: string[] = [
		"run",
		"--rm", // auto-remove container on exit
		"--name", containerLabel,
	];

	// Inject environment variables
	for (const [key, value] of Object.entries(env)) {
		args.push("-e", `${key}=${value}`);
	}

	// Additional flags (e.g. GPU, volume mounts)
	args.push(...extraFlags);

	// Image (required, always before CMD override)
	args.push(image);

	// Optional CMD override
	if (cmd) {
		args.push(cmd);
	}

	const jobLabel = env.DOCKER_TASK_JOB_ID ?? "docker-task";

	logger.info("Spawning Docker container", {
		image,
		containerLabel,
		timeoutMs: timeout,
		jobId: jobLabel,
		envKeys: Object.keys(env).filter((k) => !k.includes("URI") && !k.includes("KEY") && !k.includes("SECRET")),
	});

	const startTime = Date.now();

	try {
		const child: ExecaChildProcess = execa("docker", args, {
			timeout,
			maxBuffer: 10 * 1024 * 1024, // 10 MB output buffer
		} as Options);

		// Stream stdout in real-time
		if (child.stdout) {
			child.stdout.on("data", (chunk: Buffer | string) => {
				const lines = String(chunk).split("\n").filter((l) => l.trim());
				for (const line of lines) {
					logger.info(`[docker:${containerLabel}] stdout`, { line });
				}
			});
		}

		// Stream stderr in real-time
		if (child.stderr) {
			child.stderr.on("data", (chunk: Buffer | string) => {
				const lines = String(chunk).split("\n").filter((l) => l.trim());
				for (const line of lines) {
					logger.warn(`[docker:${containerLabel}] stderr`, { line });
				}
			});
		}

		const result = await child;
		const elapsed = Date.now() - startTime;

		logger.info("Docker container completed", {
			containerLabel,
			exitCode: result.exitCode,
			elapsedMs: elapsed,
			jobId: jobLabel,
		});

		if (result.exitCode !== 0) {
			throw new DockerRunnerError(
				`Docker container exited with code ${result.exitCode} after ${elapsed}ms`,
				result.exitCode,
				result.stdout ?? "",
				result.stderr ?? "",
			);
		}
	} catch (error) {
		const elapsed = Date.now() - startTime;

		// Handle execa timeout
		if (error instanceof Error && "timedOut" in error && (error as { timedOut: boolean }).timedOut) {
			logger.error("Docker container timed out — killing", {
				containerLabel,
				elapsedMs: elapsed,
				timeoutMs: timeout,
				jobId: jobLabel,
			});

			// Best-effort: kill the container so it doesn't linger
			try {
				await execa("docker", ["kill", containerLabel], { timeout: 10_000 });
			} catch {
				// Container may have already exited — ignore
			}

			throw new DockerRunnerError(
				`Docker container timed out after ${timeout}ms (elapsed: ${elapsed}ms)`,
				null,
				"",
				`Container ${containerLabel} exceeded timeout of ${timeout}ms`,
			);
		}

		// Re-throw DockerRunnerError as-is
		if (error instanceof DockerRunnerError) {
			throw error;
		}

		// Docker not available or other system error
		if (error instanceof Error) {
			logger.error("Docker spawn failed", {
				error: error.message,
				containerLabel,
				jobId: jobLabel,
			});
			throw new DockerRunnerError(
				`Docker spawn failed: ${error.message}`,
				null,
				"",
				error.stack ?? "",
			);
		}

		// Unknown error type — wrap and throw
		throw new DockerRunnerError(
			"Unknown Docker runner error",
			null,
			"",
			String(error),
		);
	}
}
