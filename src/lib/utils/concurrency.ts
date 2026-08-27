/**
 * Runs `fn` over `items` with at most `concurrency` in flight at once.
 * Used to fan out many outbound HTTP calls (Steam appdetails per region,
 * Anakin scrape jobs) without hammering the target or a serverless
 * function's execution time limit.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}
