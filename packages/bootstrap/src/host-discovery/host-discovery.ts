import type { AtlasHostDiscoveryBinding } from '@atlas/schema';
import { assertAtlasHostDiscovery } from '@atlas/schema';

export function resolveHostDiscovery(
  value: unknown,
  hostId: string,
  currentUrl: string,
): AtlasHostDiscoveryBinding {
  assertAtlasHostDiscovery(value);
  if (value.hostId !== hostId) {
    throw new Error('Atlas host discovery belongs to a different host.');
  }
  const current = new URL(currentUrl);
  const binding = [...value.bindings]
    .filter((candidate) => matchesLocation(candidate.baseUrl, current))
    .sort((left, right) => right.baseUrl.length - left.baseUrl.length)[0];
  if (!binding) {
    throw new Error(
      `Atlas has no deployment binding for this host URL: ${current.origin}${current.pathname}`,
    );
  }
  return binding;
}

export function atlasHostDiscoveryUrl(
  registryUrl: string,
  hostId: string,
): string {
  return new URL(
    `hosts/${encodeURIComponent(hostId)}/discovery.json`,
    `${registryUrl}/`,
  ).href;
}

function matchesLocation(baseUrl: string, current: URL): boolean {
  const base = new URL(baseUrl);
  if (base.origin !== current.origin) return false;
  const basePath = base.pathname.replace(/\/$/u, '');
  return (
    basePath === '' ||
    current.pathname === basePath ||
    current.pathname.startsWith(`${basePath}/`)
  );
}
