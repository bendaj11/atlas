import { assertAtlasBootstrapManifest } from '@atlas/bootstrap';
import type { AtlasConfig } from '@atlas/schema';
import { join } from 'node:path';
import { CliArguments } from '../../cli/arguments.js';
import {
  configuredHostIds,
  hostIdFromRoute,
  isBaseHostUrl,
  routePaths,
  supportsAnyHost,
  urlWithPath,
} from '../config/config.js';
import { HOST_DISCOVERY_TIMEOUT_MS } from '../constants.js';
import { saveWorkspaceLocalEnv } from '../../workspace/env/env.js';
import type { DevPrompts, DevTarget } from '../types.js';
import { ui } from '../../cli/ui/ui.js';

export async function resolveDevTarget(
  config: AtlasConfig,
  args: CliArguments,
  prompts: DevPrompts,
): Promise<DevTarget> {
  const configuredHostUrl = args.flag('host-url') ?? process.env.ATLAS_HOST_URL;
  const baseHostUrl = configuredHostUrl ?? (await promptForHostUrl(prompts));
  const hostId = await resolveHostId(config, baseHostUrl);
  const hostUrl = await resolveHostUrl(
    config,
    { hostId, hostUrl: baseHostUrl },
    prompts,
  );
  return {
    hostId,
    hostUrl,
    promptedForHostUrl: prompts.interactive && !configuredHostUrl,
  };
}

export async function offerToSaveDevTarget(
  projectRoot: string,
  target: DevTarget,
  prompts: Pick<DevPrompts, 'interactive' | 'select'>,
): Promise<void> {
  if (!target.promptedForHostUrl) return;
  const answer = await prompts.select(
    'Save this host URL to project .env.local?',
    [
      { label: 'Yes', value: 'yes' },
      { label: 'No', value: 'no' },
    ],
  );
  if (answer === 'no') return;
  await saveWorkspaceLocalEnv(projectRoot, { ATLAS_HOST_URL: target.hostUrl });
  ui.success(`Saved local host URL to ${join(projectRoot, '.env.local')}.`);
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
    const bootstrapUrl = new URL('/atlas.bootstrap.json', hostUrl).href;
    const response = await fetch(bootstrapUrl, {
      cache: 'no-store',
      signal: AbortSignal.timeout(HOST_DISCOVERY_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const bootstrap: unknown = await response.json();
    assertAtlasBootstrapManifest(bootstrap);
    return bootstrap.hostId;
  } catch (cause) {
    throw new Error(
      `Host URL "${hostUrl}" does not expose valid Atlas bootstrap metadata at /atlas.bootstrap.json.`,
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
      `Multiple routes found for host "${hostId}". Pass a full --host-url or set ATLAS_HOST_URL to a full URL.`,
    );
  }
  const path = await prompts.select(
    'Route opened for local development',
    paths.map((value) => ({ label: value, value })),
  );
  return urlWithPath(hostUrl, path);
}

async function promptForHostUrl(
  prompts: Pick<DevPrompts, 'interactive' | 'input'>,
): Promise<string> {
  if (prompts.interactive)
    return prompts.input('Host URL for local development');
  throw new Error(
    'Host URL is required. Pass --host-url or set ATLAS_HOST_URL.',
  );
}
