/**
 * Returns a scheduler that runs at most `concurrency` tasks at once; extra tasks wait in FIFO order.
 */
export const createLimiter = (concurrency: number) => {
  let active = 0;
  const queue: Array<() => void> = [];

  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (active < concurrency) {
      active++;
    } else {
      // The finishing task hands its slot over directly, so `active` stays unchanged.
      await new Promise<void>(resolve => queue.push(resolve));
    }
    try {
      return await task();
    } finally {
      const next = queue.shift();
      if (next) {
        next();
      } else {
        active--;
      }
    }
  };
};
