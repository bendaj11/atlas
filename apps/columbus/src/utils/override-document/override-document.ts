import type { ArtifactVersion } from '../../types/artifact-version';
import type { HostData } from '../../types/host-data';
import type {
  AtlasArtifactOverride,
  AtlasOverrideDocument as OverrideDocument,
} from '../../types/override-document';
import { isRecord } from '../messages/messages';

interface CreateOverrideDocumentOptions {
  hostData: HostData;
  overrides: Map<string, ArtifactVersion>;
}

export function createOverrideDocument({
  hostData,
  overrides,
}: CreateOverrideDocumentOptions): OverrideDocument {
  const selectedArtifactVersions = [...overrides.values()];
  const hostManifest = selectedArtifactVersions.find(
    (manifest) => manifest.kind === 'host',
  );
  return {
    schemaVersion: '1',
    hostId: hostData.config.hostId,
    generatedAt: new Date().toISOString(),
    ...(hostManifest ? { hostOverride: hostManifest } : {}),
    overrides: selectedArtifactVersions
      .filter((manifest) => manifest.kind === 'app')
      .map((manifest) => ({
        appId: manifest.id,
        manifest,
        reason: overrideReason(manifest),
      })),
  };
}

export function countOverrides(document: {
  overrides: unknown[];
  hostOverride?: unknown;
}): number {
  return document.overrides.length + (document.hostOverride ? 1 : 0);
}

export function isStoredOverrideDocument(
  value: unknown,
): value is OverrideDocument {
  return (
    isRecord(value) &&
    value.schemaVersion === '1' &&
    typeof value.hostId === 'string' &&
    typeof value.generatedAt === 'string' &&
    (value.hostOverride === undefined ||
      isStoredManifest(value.hostOverride)) &&
    Array.isArray(value.overrides) &&
    value.overrides.every(isStoredOverride)
  );
}

function isStoredOverride(value: unknown): value is AtlasArtifactOverride {
  return (
    isRecord(value) &&
    typeof value.appId === 'string' &&
    isStoredManifest(value.manifest) &&
    value.appId === value.manifest.id &&
    (value.reason === 'local' ||
      value.reason === 'pr' ||
      value.reason === 'historical')
  );
}

function overrideReason(
  manifest: ArtifactVersion,
): 'local' | 'pr' | 'historical' {
  if (manifest.channel === 'local') return 'local';
  if (manifest.channel === 'pr') return 'pr';
  return 'historical';
}

export function isStoredManifest(value: unknown): value is ArtifactVersion {
  return (
    isRecord(value) &&
    value.schemaVersion === '1' &&
    (value.kind === 'host' || value.kind === 'app') &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.version === 'string' &&
    typeof value.buildId === 'string' &&
    (value.channel === 'production' ||
      value.channel === 'pr' ||
      value.channel === 'local') &&
    (value.framework === 'angular' ||
      value.framework === 'react' ||
      value.framework === 'vue') &&
    typeof value.remoteEntryUrl === 'string'
  );
}
