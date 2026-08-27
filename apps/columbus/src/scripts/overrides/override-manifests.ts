import {
  type AtlasExtensionManifest as Manifest,
  type AtlasHostData as HostData,
  getArtifactKey,
} from '../../types/contracts.js';
import { normalizeStoredManifest } from '../manifests/manifest-utils/manifest-utils.js';

interface IncludeOverrideAppsOptions {
  hostData: HostData;
  overrideManifests: Iterable<Manifest>;
}

export function extractActiveOverrideManifests(
  hostData: HostData,
): Map<string, Manifest> {
  const overrideDocument = hostData.overrides;
  const selectedManifests = [
    ...(overrideDocument?.hostOverride ? [overrideDocument.hostOverride] : []),
    ...(overrideDocument?.overrides ?? []).map((override) => override.manifest),
  ];

  return new Map(
    selectedManifests.map((manifest) => [
      getArtifactKey(manifest),
      normalizeStoredManifest(manifest),
    ]),
  );
}

export function includeOverrideAppsInCatalog({
  hostData,
  overrideManifests,
}: IncludeOverrideAppsOptions): HostData {
  const apps = [...hostData.catalog.apps];
  const widgetProviders = [...(hostData.catalog.widgetProviders ?? [])];
  const knownArtifactKeys = new Set(
    [...apps, ...widgetProviders].map(getArtifactKey),
  );
  const dependencyIds = new Set(
    apps.flatMap((manifest) => manifest.externalAppsDependencies ?? []),
  );

  for (const manifest of overrideManifests) {
    if (
      manifest.kind !== 'app' ||
      knownArtifactKeys.has(getArtifactKey(manifest))
    )
      continue;
    if (dependencyIds.has(manifest.id)) widgetProviders.push(manifest);
    else apps.push(manifest);
    knownArtifactKeys.add(getArtifactKey(manifest));
  }

  return {
    ...hostData,
    catalog: { ...hostData.catalog, apps, widgetProviders },
  };
}
