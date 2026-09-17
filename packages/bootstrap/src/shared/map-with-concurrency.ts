export async function mapWithConcurrency<T, R>({
  values,
  operation,
  concurrency,
}: {
  values: readonly T[];
  operation: (value: T) => Promise<R>;
  concurrency: number;
}): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;

      const value = values[index];
      if (value !== undefined) results[index] = await operation(value);
    }
  };

  const workerCount = Math.min(concurrency, values.length);
  await Promise.all(Array.from({ length: workerCount }, worker));

  return results;
}
