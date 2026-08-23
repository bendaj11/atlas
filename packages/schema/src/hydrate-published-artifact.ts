import type { AtlasHostManifest } from './atlas-host-manifest.js';
import type { AtlasManifest } from './atlas-manifest.js';
import type { AtlasAppArtifactManifest } from './atlas-publication.js';
import { assertPublishedArtifactManifest } from './publication-validation.js';

export function hydratePublishedArtifactManifest(
  value: unknown,
  manifestUrl: string,
): AtlasManifest | AtlasHostManifest {
  assertPublishedArtifactManifest(value);

  const root = new URL('.', manifestUrl).href;
  const entry = value.files.find(({ path }) => path === value.entryPath);
  if (!entry) {
    throw new Error(`Atlas manifest "${manifestUrl}" has no entry payload.`);
  }

  const source = value.preview ?? value.source;
  const base = {
    schemaVersion: '1' as const,
    id: value.id,
    name: value.name,
    version: value.release?.version ?? `preview-${value.preview!.number}`,
    buildId: 'canonical',
    channel: value.preview ? ('pr' as const) : ('production' as const),
    framework: value.framework,
    remoteEntryUrl: new URL(value.entryPath, root).href,
    exposes: value.exposes,
    integrity: digestToIntegrity(entry.digest),
    createdAt: '1970-01-01T00:00:00.000Z',
    ...(source?.gitSha ? { gitSha: source.gitSha } : {}),
    ...(source?.gitBranch ? { gitBranch: source.gitBranch } : {}),
    ...(source?.gitCommitTitle
      ? { gitCommitTitle: source.gitCommitTitle }
      : {}),
    ...(value.preview ? { prNumber: value.preview.number } : {}),
    ...(value.styles?.length
      ? {
          styles: value.styles.map(({ path, integrity }) => ({
            href: new URL(path, root).href,
            integrity,
          })),
        }
      : {}),
  };

  if (value.kind === 'host-artifact') {
    return {
      ...base,
      kind: 'host',
      requiredLoaderApiVersion: value.requiredLoaderApiVersion,
    };
  }

  return hydrateApp(value, root, base);
}

function hydrateApp(
  artifact: AtlasAppArtifactManifest,
  root: string,
  base: Omit<
    AtlasManifest,
    'kind' | 'requiredHostSdkVersion' | 'supportedHosts' | 'placements'
  >,
): AtlasManifest {
  return {
    ...base,
    kind: 'app',
    ...(artifact.isolation ? { isolation: artifact.isolation } : {}),
    requiredHostSdkVersion: artifact.requiredHostSdkVersion,
    supportedHosts: artifact.supportedHosts,
    placements: artifact.placements,
    ...(artifact.metadata ? { metadata: artifact.metadata } : {}),
    ...(artifact.externalAppsDependencies?.length
      ? { externalAppsDependencies: artifact.externalAppsDependencies }
      : {}),
    ...(artifact.exportedWidgets?.length
      ? {
          exportedWidgets: artifact.exportedWidgets.map((widget) => ({
            ...widget,
            remoteEntryUrl: new URL(artifact.entryPath, root).href,
          })),
        }
      : {}),
  };
}

function digestToIntegrity(digest: `sha256:${string}`): string {
  const bytes =
    digest
      .slice('sha256:'.length)
      .match(/.{2}/gu)
      ?.map((value) => String.fromCharCode(Number.parseInt(value, 16)))
      .join('') ?? '';
  return `sha256-${btoa(bytes)}`;
}
