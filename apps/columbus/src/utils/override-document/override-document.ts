import type { ArtifactVersion } from '../../types/artifact-version';
import type { HostData } from '../../types/host-data';
import type { AtlasOverrideDocument as OverrideDocument } from '../../types/override-document';
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
  if (!isRecord(value)) return false;
  const documentValue = value as Partial<OverrideDocument>;
  return (
    documentValue.schemaVersion === '1' &&
    typeof documentValue.hostId === 'string' &&
    typeof documentValue.generatedAt === 'string' &&
    (documentValue.hostOverride === undefined ||
      isStoredManifest(documentValue.hostOverride)) &&
    Array.isArray(documentValue.overrides) &&
    documentValue.overrides.every(isStoredOverride)
  );
}

function isStoredOverride(
  value: unknown,
): value is OverrideDocument['overrides'][number] {
  if (!isRecord(value)) return false;
  const override = value as Partial<OverrideDocument['overrides'][number]>;
  return (
    typeof override.appId === 'string' &&
    isStoredManifest(override.manifest) &&
    override.appId === override.manifest.id &&
    (override.reason === 'local' ||
      override.reason === 'pr' ||
      override.reason === 'historical')
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
  if (!isRecord(value)) return false;
  const manifest = value as Partial<ArtifactVersion>;
  return (
    manifest.schemaVersion === '1' &&
    (manifest.kind === 'host' || manifest.kind === 'app') &&
    typeof manifest.id === 'string' &&
    typeof manifest.name === 'string' &&
    typeof manifest.version === 'string' &&
    typeof manifest.buildId === 'string' &&
    (manifest.channel === 'production' ||
      manifest.channel === 'pr' ||
      manifest.channel === 'local') &&
    (manifest.framework === 'angular' ||
      manifest.framework === 'react' ||
      manifest.framework === 'vue') &&
    typeof manifest.remoteEntryUrl === 'string'
  );
}
