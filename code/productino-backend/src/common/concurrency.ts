/**
 * lets at most `maxConcurrent` async tasks run side by side
 * anything over that waits its turn and starts as slots free up
 * stay "polite" to a rate-limited provider but in parallel.
 * (e.g. one LLM call per epic)
 */
export function createConcurrencyLimiter(maxConcurrent: number) {
  // How many tasks are running right now, and who's waiting for a free slot.
  let runningCount = 0;
  const waiting: Array<() => void> = [];

  // A task just finished: give its slot back and wake the next one in line.
  const freeSlot = () => {
    runningCount--;
    const wakeNextInLine = waiting.shift();
    wakeNextInLine?.();
  };

  return async function runWhenSlotFree<T>(task: () => Promise<T>): Promise<T> {
    // No slot available? Park here until someone hands one over.
    if (runningCount >= maxConcurrent) {
      await new Promise<void>((wakeMe) => waiting.push(wakeMe));
    }

    runningCount++;
    try {
      return await task();
    } finally {
      // Always release the slot — even if the task threw — so we never leak one.
      freeSlot();
    }
  };
}

/**
 * Lock and run one at the time per key
 *
 * e.g. a double-clicked "Score" on one project shouldn't spawn two ProjectRounds
 */
export class PerKeyLock {
  private readonly lastTaskByKey = new Map<string, Promise<unknown>>();

  run<T>(key: string | number, task: () => Promise<T>): Promise<T> {
    const keyText = String(key);
    const runAfter = this.lastTaskByKey.get(keyText) ?? Promise.resolve();

    const result = runAfter.then(task, task);

    const settled = result.then(
      () => undefined,
      () => undefined,
    );
    this.lastTaskByKey.set(keyText, settled);

    void settled.then(() => {
      if (this.lastTaskByKey.get(keyText) === settled) this.lastTaskByKey.delete(keyText);
    });

    return result;
  }
}
