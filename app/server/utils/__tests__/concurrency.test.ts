import { describe, it, expect } from 'vitest';
import { createLimiter } from '../concurrency';

const deferred = () => {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const flush = () => new Promise<void>(resolve => setImmediate(resolve));

describe('createLimiter', () => {
  it('never exceeds the cap and starts queued tasks FIFO, behind tasks that were already waiting', async () => {
    const limit = createLimiter(2);
    const gates = Array.from({ length: 5 }, deferred);
    const started: number[] = [];
    let active = 0;
    let maxActive = 0;
    const run = (index: number) =>
      limit(async () => {
        started.push(index);
        active++;
        maxActive = Math.max(maxActive, active);
        await gates[index].promise;
        active--;
      });

    const runs = [0, 1, 2, 3].map(run);
    await flush();
    expect(started).toEqual([0, 1]);

    gates[0].resolve();
    runs.push(run(4));
    await flush();
    expect(started).toEqual([0, 1, 2]);
    expect(maxActive).toBe(2);

    gates.forEach(gate => gate.resolve());
    await Promise.all(runs);
    expect(started).toEqual([0, 1, 2, 3, 4]);
    expect(maxActive).toBe(2);
  });

  it('frees the slot when a task rejects', async () => {
    const limit = createLimiter(1);
    const failing = deferred();
    const first = limit(() => failing.promise);
    const second = limit(async () => 'ran');

    failing.reject(new Error('boom'));
    await expect(first).rejects.toThrow('boom');
    await expect(second).resolves.toBe('ran');
  });
});
