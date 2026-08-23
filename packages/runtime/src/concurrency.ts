const DEFAULT_CONCURRENCY = 8;

export async function mapWithConcurrency<T, R>(
  values: readonly T[],
  operation: (value: T) => Promise<R>,
  concurrency = DEFAULT_CONCURRENCY,
): Promise<R[]> {
  let nextIndex = 0;
  const results = new Array<R>(values.length);
  const worker = async (): Promise<void> => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      const value = values[index];
      nextIndex += 1;
      if (value !== undefined) results[index] = await operation(value);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, worker),
  );
  return results;
}
