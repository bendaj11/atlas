import {
  type ArtifactVersion,
  isAppArtifactVersion,
} from '../../types/artifact-version';
import { placementTargetsHost } from '@atlas/schema';
import { CUSTOM_BUILD_ID, CUSTOM_VERSION } from '../constants/constants';
import type { ArtifactOverride } from '../../types/artifact';

const SHORT_BUILD_ID_LENGTH = 7;

interface IsArtifactVersionSupportedByHostOptions {
  artifactVersion: ArtifactVersion;
  hostId: string;
}

export interface CreateCustomArtifactVersionOptions extends Pick<
  ArtifactOverride,
  'deployedArtifactVersion'
> {
  rawUrl: string;
}

export function createCustomArtifactVersion({
  deployedArtifactVersion,
  rawUrl,
}: CreateCustomArtifactVersionOptions): ArtifactVersion {
  const baseUrl = validatedBaseUrl(rawUrl);

  const artifactVersion: ArtifactVersion = {
    ...deployedArtifactVersion,
    version: CUSTOM_VERSION,
    buildId: CUSTOM_BUILD_ID,
    channel: 'local',
    remoteEntryUrl: `${baseUrl}/remoteEntry.json`,
    styles:
      deployedArtifactVersion.framework === 'angular'
        ? [{ href: `${baseUrl}/styles.css` }]
        : [],
  };
  delete artifactVersion.integrity;
  if (
    isAppArtifactVersion(deployedArtifactVersion) &&
    isAppArtifactVersion(artifactVersion) &&
    deployedArtifactVersion.exportedWidgets
  ) {
    artifactVersion.exportedWidgets =
      deployedArtifactVersion.exportedWidgets.map((widget) => ({
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

export function baseUrlFromRemoteEntry(remoteEntryUrl: string): string {
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

export function isArtifactVersionSupportedByHost({
  artifactVersion,
  hostId,
}: IsArtifactVersionSupportedByHostOptions): boolean {
  if (!isAppArtifactVersion(artifactVersion))
    return artifactVersion.id === hostId;

  return (
    artifactVersion.supportedHosts.includes('*') ||
    artifactVersion.supportedHosts.includes(hostId) ||
    artifactVersion.placements.some((placement) =>
      placementTargetsHost(placement, hostId),
    )
  );
}
