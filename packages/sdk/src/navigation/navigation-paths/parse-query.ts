import type { AtlasQueryValues } from '../navigation-types/navigation-types.js';

/** Parses a search string; a key repeated in the search collects its values into an array. */
export function parseQuery(search: string): AtlasQueryValues {
  const result: Record<string, string | string[]> = {};

  for (const [key, value] of new URLSearchParams(search)) {
    result[key] = appendQueryValue(result[key], value);
  }

  return result;
}

function appendQueryValue(
  current: string | string[] | undefined,
  value: string,
): string | string[] {
  if (current === undefined) return value;

  return Array.isArray(current) ? [...current, value] : [current, value];
}
