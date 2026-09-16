import type { ArtifactVersion } from '../../types/artifact-version';
import type { HostData } from '../../types/host-data';
import { getArtifactKey } from '../artifact-versions/artifact-version-keys/artifact-version-keys';
import { normalizeStoredArtifactVersion } from '../artifact-versions/artifact-version-utils/artifact-version-utils';

interface IncludeOverrideAppsOptions {
  hostData: HostData;
  overrideArtifactVersions: Iterable<ArtifactVersion>;
}

export function extractEnabledArtifactVersionOverrides(
  hostData: HostData,
): Map<string, ArtifactVersion> {
  const overrideDocument = hostData.overrides;
  const selectedArtifactVersions = [
    ...(overrideDocument?.hostOverride ? [overrideDocument.hostOverride] : []),
    ...(overrideDocument?.overrides ?? []).map((override) => override.manifest),
  ];

  return new Map(
    selectedArtifactVersions.map((artifactVersion) => [
      getArtifactKey(artifactVersion),
      normalizeStoredArtifactVersion(artifactVersion),
    ]),
  );
}

export function includeOverrideAppsInCatalog({
  hostData,
  overrideArtifactVersions,
}: IncludeOverrideAppsOptions): HostData {
  const apps = [...hostData.catalog.apps];
  const widgetProviders = [...(hostData.catalog.widgetProviders ?? [])];
  const knownArtifactKeys = new Set(
    [...apps, ...widgetProviders].map(getArtifactKey),
  );
  const dependencyIds = new Set(
    apps.flatMap(
      (artifactVersion) => artifactVersion.externalAppsDependencies ?? [],
    ),
  );

  for (const artifactVersion of overrideArtifactVersions) {
    if (
      artifactVersion.kind !== 'app' ||
      knownArtifactKeys.has(getArtifactKey(artifactVersion))
    )
      continue;
    if (dependencyIds.has(artifactVersion.id))
      widgetProviders.push(artifactVersion);
    else apps.push(artifactVersion);
    knownArtifactKeys.add(getArtifactKey(artifactVersion));
  }

  return {
    ...hostData,
    catalog: { ...hostData.catalog, apps, widgetProviders },
  };
}
