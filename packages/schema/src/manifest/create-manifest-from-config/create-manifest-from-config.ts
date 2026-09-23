import type { AtlasManifest } from '../atlas-manifest.js';
import type { AtlasAppConfig } from '../../config/atlas-config.js';
import type { AtlasPlacement } from '../atlas-placement/atlas-placement.js';
import { ATLAS_ALL_HOSTS } from '../atlas-placement/atlas-placement.js';
import type { CreateManifestFromConfigInput } from './create-manifest-from-config-input.js';
import { assertAtlasManifest } from '../assert-atlas-manifest/assert-atlas-manifest.js';

/** Builds the manifest JSON a host needs to load one app build. */
export function createManifestFromConfig(
  input: CreateManifestFromConfigInput,
): AtlasManifest {
  const placements = createPlacementsFromConfig(input.config);
  const manifest: AtlasManifest = {
    schemaVersion: '1',
    kind: 'app',
    id: input.config.id,
    name: input.config.name ?? input.config.id,
    version: input.version,
    buildId: input.buildId,
    channel: input.channel ?? 'production',
    framework: input.config.framework,
    isolation: input.config.domIsolation ?? 'shadow-dom',
    remoteEntryUrl: input.remoteEntryUrl,
    exposes: { entry: './entry' },
    requiredHostSdkVersion: input.config.requiredHostSdkVersion ?? '^0.1.0',
    supportedHosts: collectSupportedHostIds(placements),
    placements,
    createdAt: input.createdAt ?? new Date().toISOString(),
    ...(input.exportedWidgets?.length
      ? { exportedWidgets: input.exportedWidgets }
      : {}),
    ...(input.config.externalAppsDependencies?.length
      ? {
          externalAppsDependencies: [
            ...new Set(input.config.externalAppsDependencies),
          ],
        }
      : {}),
    ...(input.styles?.length ? { styles: input.styles } : {}),
    ...(input.integrity ? { integrity: input.integrity } : {}),
    ...(input.gitSha ? { gitSha: input.gitSha } : {}),
    ...(input.gitBranch ? { gitBranch: input.gitBranch } : {}),
    ...(input.gitCommitTitle ? { gitCommitTitle: input.gitCommitTitle } : {}),
    ...(input.prNumber ? { prNumber: input.prNumber } : {}),
  };
  assertAtlasManifest(manifest);

  return manifest;
}

function createPlacementsFromConfig(config: AtlasAppConfig): AtlasPlacement[] {
  const ids = new Map<string, number>();
  const uniqueId = (hostId: string, name: string, suffix: string): string => {
    const baseId = buildPlacementId({ hostId, name, suffix });
    const count = (ids.get(baseId) ?? 0) + 1;
    ids.set(baseId, count);

    return count === 1 ? baseId : `${baseId}-${count}`;
  };

  return [
    ...(config.routes ?? []).map((route) => ({
      id: uniqueId(route.hostId, route.path, 'route'),
      kind: 'route' as const,
      hostId: route.hostId,
      route: {
        path: route.path,
        ...(route.match !== undefined ? { match: route.match } : {}),
        ...(route.redirectTo !== undefined
          ? { redirectTo: route.redirectTo }
          : {}),
        ...(route.layoutId !== undefined ? { layoutId: route.layoutId } : {}),
        ...(route.title !== undefined ? { title: route.title } : {}),
        ...(route.nav ? { nav: route.nav } : {}),
      },
    })),
    ...(config.slots ?? []).map((slot) => ({
      id: uniqueId(slot.hostId, slot.slotId, 'slot'),
      kind: 'slot' as const,
      hostId: slot.hostId,
      slot: slot.slotId,
    })),
  ];
}

function collectSupportedHostIds(
  placements: readonly AtlasPlacement[],
): string[] {
  const hosts = [...new Set(placements.map((placement) => placement.hostId))];

  return hosts.length ? hosts : [ATLAS_ALL_HOSTS];
}

function buildPlacementId(input: {
  hostId: string;
  name: string;
  suffix: string;
}): string {
  const value = `${input.hostId}-${input.name}`
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return value ? `${value}-${input.suffix}` : input.suffix;
}
