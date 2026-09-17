export type SkipEntry = string | RegExp | ((specifier: string) => boolean);

/** True when any `skip` entry matches the specifier: exact string, regular expression, or predicate. */
export function isSkippedDependency(
  specifier: string,
  skip: readonly SkipEntry[] = [],
): boolean {
  return skip.some((entry) => {
    if (typeof entry === 'string') return entry === specifier;

    if (typeof entry === 'function') return entry(specifier);

    entry.lastIndex = 0;

    return entry.test(specifier);
  });
}
