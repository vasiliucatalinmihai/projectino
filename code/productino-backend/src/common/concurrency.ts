/**
 * Cap how many of `fn` run at once. Returns a wrapper; excess calls queue.
 * Used to throttle fan-out (e.g. per-epic delivery calls) so a burst of
 * parallel LLM requests doesn't trip provider rate limits.
 */
export function pLimit(concurrency: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  const release = () => {
    active--;
    queue.shift()?.();
  };
  return async function limited<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= concurrency) await new Promise<void>((resolve) => queue.push(resolve));
    active++;
    try {
      return await fn();
    } finally {
      release();
    }
  };
}

/**
 * Serializes work per key so two requests for the same project can't race
 * (e.g. double-clicking "Score" → duplicate ProjectRound). Single-instance
 * only; the multi-instance equivalent is a Postgres `pg_advisory_xact_lock`.
 */
export class KeyedMutex {
  private readonly chain = new Map<string, Promise<unknown>>();

  run<T>(key: string | number, fn: () => Promise<T>): Promise<T> {
    const k = String(key);
    const prev = this.chain.get(k) ?? Promise.resolve();
    // Start fn after the predecessor settles (success OR failure).
    const result = prev.then(fn, fn);
    // The chain tail swallows errors so one failure doesn't reject the next.
    const tail = result.then(
      () => undefined,
      () => undefined,
    );
    this.chain.set(k, tail);
    // Drop the key once idle to avoid unbounded growth.
    void tail.then(() => {
      if (this.chain.get(k) === tail) this.chain.delete(k);
    });
    return result;
  }
}
