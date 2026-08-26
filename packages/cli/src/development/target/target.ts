import { assertAtlasRuntimeConfig } from '@atlas/bootstrap';
import type { AtlasConfig } from '@atlas/schema';
import {
  configuredHostIds,
  hostIdFromRoute,
  isBaseHostUrl,
  routePaths,
  supportsAnyHost,
  urlWithPath,
} from '../config/config.js';
import { HOST_DISCOVERY_TIMEOUT_MS } from '../constants.js';
import type {
  DevPrompts,
  DevTarget,
  ResolveDevTargetOptions,
} from '../types.js';

export async function resolveDevTarget({
  config,
  prompts,
  previewUrls,
}: ResolveDevTargetOptions): Promise<DevTarget> {
  const baseHostUrl = await selectPreviewUrl(previewUrls, prompts);
  const hostId = await resolveHostId(config, baseHostUrl);
  const hostUrl = await resolveHostUrl(
    config,
    { hostId, hostUrl: baseHostUrl },
    prompts,
  );
  return {
    hostId,
    hostUrl,
  };
}

async function selectPreviewUrl(
  previewUrls: readonly string[],
  prompts: DevPrompts,
): Promise<string> {
  if (previewUrls.length === 0) {
    throw new Error(
      'package.json atlas.previews is required for atlas dev apps.',
    );
  }
  if (previewUrls.length === 1) return previewUrls[0];
  if (!prompts.interactive) {
    throw new Error(
      'Multiple Atlas previews configured. Run atlas dev interactively.',
    );
  }
  return await prompts.select(
    'Preview URL for local development',
    previewUrls.map((url) => ({ label: url, value: url })),
  );
}

async function resolveHostId(
  config: AtlasConfig,
  hostUrl: string,
): Promise<string> {
  const hostIds = configuredHostIds(config);
  if (hostIds.length === 1) return hostIds[0]!;
  const routeHostId = hostIdFromRoute(config, hostUrl);
  if (routeHostId) return routeHostId;
  const hostId = await discoverHostId(hostUrl);
  if (
    hostIds.length > 0 &&
    !supportsAnyHost(config) &&
    !hostIds.includes(hostId)
  ) {
    throw new Error(
      `Host URL identifies "${hostId}", but app "${config.id}" has no route or slot for that host.`,
    );
  }
  return hostId;
}

async function discoverHostId(hostUrl: string): Promise<string> {
  try {
    const runtimeUrl = new URL('/atlas.runtime.json', hostUrl).href;
    const response = await fetch(runtimeUrl, {
      cache: 'no-store',
      signal: AbortSignal.timeout(HOST_DISCOVERY_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const runtime: unknown = await response.json();
    assertAtlasRuntimeConfig(runtime);
    return runtime.hostId;
  } catch (cause) {
    throw new Error(
      `Host URL "${hostUrl}" does not expose valid Atlas runtime config at /atlas.runtime.json.`,
      { cause },
    );
  }
}

async function resolveHostUrl(
  config: AtlasConfig,
  target: Pick<DevTarget, 'hostId' | 'hostUrl'>,
  prompts: DevPrompts,
): Promise<string> {
  const { hostId, hostUrl } = target;
  if (!isBaseHostUrl(hostUrl)) return hostUrl;
  const paths = routePaths(config, hostId);
  if (paths.length === 0) return hostUrl;
  if (paths.length === 1) return urlWithPath(hostUrl, paths[0]!);
  if (!prompts.interactive) {
    throw new Error(
      `Multiple routes found for host "${hostId}". Define a full URL in atlas.previews.`,
    );
  }
  const path = await prompts.select(
    'Route opened for local development',
    paths.map((value) => ({ label: value, value })),
  );
  return urlWithPath(hostUrl, path);
}
