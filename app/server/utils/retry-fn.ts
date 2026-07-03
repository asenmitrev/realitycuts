/**
 * Configuration options for the retry function
 */
interface RetryOptions {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Delay between retries in milliseconds */
  delayMs?: number;
  /** Whether to use exponential backoff for delays */
  exponentialBackoff?: boolean;
  /** Optional callback for handling retry attempts */
  onRetry?: (error: Error, attempt: number) => void;
}

/**
 * Retries an async function multiple times with configurable options
 * @param fn The async function to retry
 * @param options Retry configuration options
 * @returns Promise with the function result
 * @throws Last encountered error if all retries fail
 */
export async function retry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const { maxAttempts, delayMs = 1000, exponentialBackoff = false, onRetry } = options;

  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // If this was the last attempt, throw the error
      if (attempt === maxAttempts) {
        throw lastError;
      }

      // Call the onRetry callback if provided
      if (onRetry) {
        onRetry(lastError, attempt);
      }

      // Calculate delay for next attempt
      const nextDelay = exponentialBackoff ? delayMs * Math.pow(2, attempt - 1) : delayMs;

      // Wait before next retry
      await new Promise(resolve => setTimeout(resolve, nextDelay));
    }
  }

  // This should never be reached due to the throw above
  throw lastError!;
}
