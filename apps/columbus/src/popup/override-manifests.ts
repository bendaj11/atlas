import {
  artifactKey,
  type AtlasExtensionManifest as Manifest,
  type AtlasHostData as HostData,
} from '../contracts.js';
import { normalizeStoredManifest } from './manifest-utils.js';

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
      artifactKey(manifest),
      normalizeStoredManifest(manifest),
    ]),
  );
}

export function includeDisabledAppsInCatalog(
  hostData: HostData,
  disabledOverrides: ReadonlyMap<string, Manifest>,
): HostData {
  const apps = [...hostData.catalog.apps];
  const widgetProviders = [...(hostData.catalog.widgetProviders ?? [])];
  const knownArtifactKeys = new Set(apps.map(artifactKey));
  const dependencyIds = new Set(
    apps.flatMap((manifest) => manifest.externalAppsDependencies ?? []),
  );

  for (const manifest of disabledOverrides.values()) {
    if (manifest.kind !== 'app' || knownArtifactKeys.has(artifactKey(manifest)))
      continue;
    if (dependencyIds.has(manifest.id)) widgetProviders.push(manifest);
    else apps.push(manifest);
  }

  return {
    ...hostData,
    catalog: { ...hostData.catalog, apps, widgetProviders },
  };
}
