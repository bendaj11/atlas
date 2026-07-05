const DEFAULT_CONCURRENCY = 8;

export async function mapWithConcurrency<T>(
  values: readonly T[],
  operation: (value: T) => Promise<void>,
  concurrency = DEFAULT_CONCURRENCY
): Promise<void> {
  let nextIndex = 0;
  const worker = async (): Promise<void> => {
    while (nextIndex < values.length) {
      const value = values[nextIndex];
      nextIndex += 1;
      if (value !== undefined) await operation(value);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
}
