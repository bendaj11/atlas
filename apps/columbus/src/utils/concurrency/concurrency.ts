export async function mapWithConcurrency<Value, Result>(
  values: readonly Value[],
  operation: (value: Value) => Promise<Result>,
  concurrency: number,
): Promise<Result[]> {
  const results = new Array<Result>(values.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < values.length) {
      const index = next++;
      results[index] = await operation(values[index]!);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(values.length, concurrency) }, worker),
  );

  return results;
}
