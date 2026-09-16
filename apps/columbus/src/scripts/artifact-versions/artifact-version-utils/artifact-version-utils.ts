import type { ArtifactVersion } from '../../../types/artifact-version';
import { placementTargetsHost } from '@atlas/schema';
import {
  uniqueVersions,
  versionKey,
} from '../artifact-version-keys/artifact-version-keys';
import { CUSTOM_BUILD_ID, CUSTOM_VERSION } from '../../shared/constants';
import type {
  Artifact,
  ArtifactConfiguration,
  OverrideSelection,
  OverrideType,
} from '../../../types/artifact';
import type { ColumbusState } from '../../../types/columbus-state';

const SHORT_BUILD_ID_LENGTH = 7;

interface IsArtifactVersionSupportedByHostOptions {
  artifactVersion: ArtifactVersion;
  hostId: string;
}

interface ArtifactVersionFromSelectionOptions extends Pick<
  ArtifactConfiguration,
  | 'productionArtifactVersion'
  | 'productionArtifactVersions'
  | 'prArtifactVersions'
> {
  selection: OverrideSelection;
}

interface CreateCustomArtifactVersionOptions extends Pick<
  Artifact,
  'productionArtifactVersion'
> {
  rawUrl: string;
}

export function configurationOf(
  artifact: Artifact,
  {
    enabledArtifactVersionOverrides,
    disabledArtifactVersionOverrides,
    hostData,
  }: ColumbusState,
): ArtifactConfiguration {
  const { key, productionArtifactVersion } = artifact;
  const versions = uniqueVersions([
    ...(hostData.versions[key] ?? []),
    productionArtifactVersion,
  ]);

  return {
    ...artifact,
    hostId: hostData.config.hostId,
    selectedArtifactVersion:
      enabledArtifactVersionOverrides.get(key) ??
      disabledArtifactVersionOverrides.get(key),
    productionArtifactVersions: versions.filter(
      (artifactVersion) => artifactVersion.channel === 'production',
    ),
    prArtifactVersions: versions.filter(
      (artifactVersion) => artifactVersion.channel === 'pr',
    ),
  };
}

export function initialOverrideSelection(
  selectedArtifactVersion: ArtifactVersion | undefined,
): OverrideSelection {
  if (!selectedArtifactVersion) return { type: 'custom', value: '' };
  if (selectedArtifactVersion.channel === 'local')
    return {
      type: 'custom',
      value: baseUrlFromRemoteEntry(selectedArtifactVersion.remoteEntryUrl),
    };

  return {
    type: selectedArtifactVersion.channel,
    value: versionKey(selectedArtifactVersion),
  };
}

export function artifactVersionFromSelection({
  productionArtifactVersion,
  selection,
  productionArtifactVersions,
  prArtifactVersions,
}: ArtifactVersionFromSelectionOptions): ArtifactVersion {
  if (selection.type === 'custom')
    return createCustomArtifactVersion({
      productionArtifactVersion,
      rawUrl: selection.value,
    });
  if (selection.type === 'production') {
    const selectedArtifactVersion = productionArtifactVersions.find(
      (artifactVersion) => versionKey(artifactVersion) === selection.value,
    );
    if (!selectedArtifactVersion)
      throw new Error('Choose a production version.');
    return selectedArtifactVersion;
  }

  const selectedArtifactVersion = prArtifactVersions.find(
    (artifactVersion) => versionKey(artifactVersion) === selection.value,
  );
  if (!selectedArtifactVersion) throw new Error('Choose a PR version.');
  return selectedArtifactVersion;
}

function createCustomArtifactVersion({
  productionArtifactVersion,
  rawUrl,
}: CreateCustomArtifactVersionOptions): ArtifactVersion {
  const baseUrl = validatedBaseUrl(rawUrl);

  const artifactVersion: ArtifactVersion = {
    ...productionArtifactVersion,
    version: CUSTOM_VERSION,
    buildId: CUSTOM_BUILD_ID,
    channel: 'local',
    remoteEntryUrl: `${baseUrl}/remoteEntry.json`,
    styles:
      productionArtifactVersion.framework === 'angular'
        ? [{ href: `${baseUrl}/styles.css` }]
        : [],
  };
  delete artifactVersion.integrity;
  if (productionArtifactVersion.exportedWidgets) {
    artifactVersion.exportedWidgets =
      productionArtifactVersion.exportedWidgets.map((widget) => ({
        ...widget,
        remoteEntryUrl: artifactVersion.remoteEntryUrl,
      }));
  }
  return artifactVersion;
}

export function normalizeStoredArtifactVersion(
  artifactVersion: ArtifactVersion,
): ArtifactVersion {
  if (
    artifactVersion.channel !== 'local' ||
    artifactVersion.version !== CUSTOM_BUILD_ID
  )
    return artifactVersion;
  return { ...artifactVersion, version: CUSTOM_VERSION };
}

export function overrideTypeFor({
  productionArtifactVersion,
  selectedArtifactVersion,
}: Pick<Artifact, 'productionArtifactVersion' | 'selectedArtifactVersion'>):
  OverrideType | undefined {
  if (!selectedArtifactVersion) return undefined;
  if (selectedArtifactVersion.channel === 'local') return 'custom';
  if (selectedArtifactVersion.channel === 'pr') return 'pr';
  if (
    versionKey(selectedArtifactVersion) ===
    versionKey(productionArtifactVersion)
  )
    return undefined;
  return 'production';
}

export function versionLabel(artifactVersion: ArtifactVersion): string {
  if (artifactVersion.channel === 'pr') {
    const label = [
      artifactVersion.prNumber === undefined
        ? undefined
        : `PR #${artifactVersion.prNumber}`,
      artifactVersion.gitBranch,
      artifactVersion.gitSha?.slice(0, SHORT_BUILD_ID_LENGTH),
      artifactVersion.gitCommitTitle,
    ]
      .filter(isVisibleVersionLabelPart)
      .join(' · ');
    return (
      label || `PR #${artifactVersion.prNumber ?? artifactVersion.version}`
    );
  }
  if (artifactVersion.channel === 'production') {
    return [
      versionBuildIdLabel(artifactVersion),
      artifactVersion.gitCommitTitle,
    ]
      .filter(isVisibleVersionLabelPart)
      .join(' · ');
  }

  return `${artifactVersion.version} · ${shortBuildId(artifactVersion)} · Local`;
}

export function versionBuildIdLabel(artifactVersion: ArtifactVersion): string {
  return artifactVersion.buildId === 'canonical'
    ? artifactVersion.version
    : `${artifactVersion.version}-${artifactVersion.buildId}`;
}

function shortBuildId(artifactVersion: ArtifactVersion): string {
  return artifactVersion.buildId.slice(0, SHORT_BUILD_ID_LENGTH);
}

function isVisibleVersionLabelPart(part: string | undefined): part is string {
  return Boolean(part?.trim().replaceAll('.', ''));
}

function baseUrlFromRemoteEntry(remoteEntryUrl: string): string {
  return normalizeBaseUrl(remoteEntryUrl);
}

function normalizeBaseUrl(value: string): string {
  return value
    .trim()
    .replace(/\/remoteEntry\.json$/u, '')
    .replace(/\/$/u, '');
}

function validatedBaseUrl(value: string): string {
  const normalized = normalizeBaseUrl(value);
  if (!normalized) throw new Error('Enter base URL.');

  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error('Base URL must be absolute HTTP URL.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    throw new Error('Base URL must be absolute HTTP URL.');
  if (!isLoopbackHost(url.hostname))
    throw new Error('Base URL must use localhost, 127.0.0.1, or [::1].');
  if (url.username || url.password)
    throw new Error('Base URL must not include credentials.');
  if (url.search || url.hash)
    throw new Error(
      'Base URL must not include query parameters or a fragment.',
    );

  return url.href.replace(/\/$/u, '');
}

function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  );
}

export function artifactSourceDescription(
  selectedArtifactVersion: ArtifactVersion | undefined,
): string {
  if (!selectedArtifactVersion) return '';
  return selectedArtifactVersion.channel === 'local'
    ? baseUrlFromRemoteEntry(selectedArtifactVersion.remoteEntryUrl)
    : versionLabel(selectedArtifactVersion);
}

export function isArtifactVersionSupportedByHost({
  artifactVersion,
  hostId,
}: IsArtifactVersionSupportedByHostOptions): boolean {
  return (
    (artifactVersion.kind === 'host' && artifactVersion.id === hostId) ||
    artifactVersion.supportedHosts?.includes('*') === true ||
    artifactVersion.supportedHosts?.includes(hostId) === true ||
    artifactVersion.placements?.some((placement) =>
      placementTargetsHost(placement, hostId),
    ) === true
  );
}

export function isDeployedProductionVersion(
  artifactVersion: ArtifactVersion,
  deployedArtifactVersion: ArtifactVersion | undefined,
): boolean {
  return (
    artifactVersion.channel === 'production' &&
    deployedArtifactVersion?.channel === 'production' &&
    versionKey(artifactVersion) === versionKey(deployedArtifactVersion)
  );
}
