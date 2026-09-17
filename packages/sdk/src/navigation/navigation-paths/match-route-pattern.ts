import type { AtlasRouteParams } from '../navigation-types/navigation-types.js';

type PartMatch = 'match' | 'miss' | 'wildcard';

interface RoutePartRequest {
  readonly expected: string;
  readonly actual: string | undefined;
  readonly index: number;
  readonly pathParts: readonly string[];
  readonly params: Record<string, string>;
}

/** Matches `orders/:id` and `files/*` style patterns; returns decoded params or `undefined` on a miss. */
export function matchRoutePattern(
  pattern: string,
  pathname: string,
): AtlasRouteParams | undefined {
  const patternParts = splitRoutePathIntoParts(pattern);
  const pathParts = splitRoutePathIntoParts(pathname);
  const params: Record<string, string> = {};

  for (let index = 0; index < patternParts.length; index += 1) {
    const matched = matchRoutePatternPart({
      expected: patternParts[index]!,
      actual: pathParts[index],
      index,
      pathParts,
      params,
    });

    if (matched === 'wildcard') return params;

    if (matched === 'miss') return undefined;
  }

  return patternParts.length === pathParts.length ? params : undefined;
}

function splitRoutePathIntoParts(path: string): string[] {
  return path
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .filter(Boolean);
}

function matchRoutePatternPart(request: RoutePartRequest): PartMatch {
  const { expected, actual, index, pathParts, params } = request;

  if (expected === '*') {
    params.wildcard = decodeURIComponent(pathParts.slice(index).join('/'));

    return 'wildcard';
  }

  if (actual === undefined) return 'miss';

  if (expected.startsWith(':')) {
    params[expected.slice(1)] = decodeURIComponent(actual);

    return 'match';
  }

  return expected === actual ? 'match' : 'miss';
}
