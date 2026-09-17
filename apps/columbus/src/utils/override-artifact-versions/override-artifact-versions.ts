import type { ArtifactVersion } from '../../../types/artifact-version';
import type { HostData } from '../../../types/host-data';
import { normalizeStoredArtifactVersion } from '../../artifact-versions/artifact-version-utils/artifact-version-utils';

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
      artifactVersion.id,
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
    [...apps, ...widgetProviders].map((artifactVersion) => artifactVersion.id),
  );
  const dependencyIds = new Set(
    apps.flatMap(
      (artifactVersion) => artifactVersion.externalAppsDependencies ?? [],
    ),
  );

  for (const artifactVersion of overrideArtifactVersions) {
    if (
      artifactVersion.kind !== 'app' ||
      knownArtifactKeys.has(artifactVersion.id)
    )
      continue;
    if (dependencyIds.has(artifactVersion.id))
      widgetProviders.push(artifactVersion);
    else apps.push(artifactVersion);
    knownArtifactKeys.add(artifactVersion.id);
  }

  return {
    ...hostData,
    catalog: { ...hostData.catalog, apps, widgetProviders },
  };
}
