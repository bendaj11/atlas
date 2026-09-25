export async function forEachConcurrently<T>(options: {
  items: readonly T[];
  concurrency: number;
  operation: (item: T) => Promise<void>;
}): Promise<void> {
  const { items, concurrency, operation } = options;

  if (!Number.isSafeInteger(concurrency) || concurrency < 1)
    throw new Error('Concurrency must be a positive integer.');

  const pending = [...items].reverse();
  let failure: { error: unknown } | undefined;

  const drain = async (): Promise<void> => {
    while (!failure && pending.length) {
      const item = pending.pop()!;

      try {
        await operation(item);
      } catch (error) {
        failure ??= { error };
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, drain),
  );

  if (failure) throw failure.error;
}
