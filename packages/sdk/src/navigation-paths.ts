export function scopePath(basePath: string, to: string): string {
  const normalizedBasePath = normalizeBasePath(basePath);
  if (/^https?:\/\//.test(to)) {
    throw new Error("Atlas scoped navigation only accepts same-origin paths.");
  }

  if (to.startsWith(normalizedBasePath)) {
    return to;
  }

  const child = to.startsWith("/") ? to.slice(1) : to;
  return child.length === 0 ? normalizedBasePath : `${normalizedBasePath}/${child}`;
}

export function normalizeBasePath(basePath: string): string {
  if (!basePath.startsWith("/")) {
    return `/${basePath}`.replace(/\/+$/, "");
  }

  return basePath.replace(/\/+$/, "") || "/";
}

export function toInnerPath(basePath: string, pathname: string): string {
  if (basePath === "/") return pathname || "/";
  if (pathname === basePath) return "/";
  return pathname.startsWith(`${basePath}/`) ? pathname.slice(basePath.length) : "/";
}

export function parseQuery(search: string): Readonly<Record<string, string | string[]>> {
  const result: Record<string, string | string[]> = {};
  for (const [key, value] of new URLSearchParams(search)) {
    result[key] = appendQueryValue(result[key], value);
  }
  return result;
}

export function matchRoutePattern(pattern: string, pathname: string): Readonly<Record<string, string>> | undefined {
  const patternParts = splitRoutePath(pattern);
  const pathParts = splitRoutePath(pathname);
  const params: Record<string, string> = {};

  for (let index = 0; index < patternParts.length; index += 1) {
    const expected = patternParts[index]!;
    const actual = pathParts[index];
    const matched = matchRoutePart({ expected, actual, index, pathParts, params });
    if (matched === "wildcard") return params;
    if (matched === "miss") return undefined;
  }

  return patternParts.length === pathParts.length ? params : undefined;
}

function appendQueryValue(current: string | string[] | undefined, value: string): string | string[] {
  if (current === undefined) return value;
  return Array.isArray(current) ? [...current, value] : [current, value];
}

function splitRoutePath(path: string): string[] {
  return path.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
}

function matchRoutePart(options: {
  expected: string;
  actual: string | undefined;
  index: number;
  pathParts: string[];
  params: Record<string, string>;
}): "match" | "miss" | "wildcard" {
  if (options.expected === "*") {
    options.params.wildcard = decodeURIComponent(options.pathParts.slice(options.index).join("/"));
    return "wildcard";
  }

  if (options.actual === undefined) return "miss";

  if (options.expected.startsWith(":")) {
    options.params[options.expected.slice(1)] = decodeURIComponent(options.actual);
    return "match";
  }

  return options.expected === options.actual ? "match" : "miss";
}
