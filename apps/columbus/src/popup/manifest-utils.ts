import {
  artifactKey,
  type AtlasExtensionManifest as Manifest,
  type AtlasHostData as HostData,
} from '../contracts.js';
import {
  supportsHost,
  uniqueVersions,
  versionKey,
} from '../manifest-versions.js';
import { CUSTOM_BUILD_ID, CUSTOM_VERSION } from './constants.js';
import type { BadgeSkin } from '@wix/design-system';
import type { EditorDraft, OverrideType } from './types.js';

export function createAppViewModel(
  production: Manifest,
  activeOverrides: ReadonlyMap<string, Manifest>,
  savedDisabledOverrides: ReadonlyMap<string, Manifest>,
) {
  const key = artifactKey(production);
  const selected = activeOverrides.get(key) ?? savedDisabledOverrides.get(key);
  const overrideEnabled = activeOverrides.has(key);

  return {
    production,
    selected,
    overrideType: overrideTypeFor(production, selected),
    sourceDescription: selectedSourceDescription(selected),
    overrideEnabled,
    canToggle: Boolean(selected),
  };
}

export function createEditorDraft(
  production: Manifest | undefined,
  selected: Manifest | undefined,
  productionOptions: Manifest[],
  prOptions: Manifest[],
): EditorDraft {
  const type = selected
    ? overrideTypeFor(production ?? selected, selected)
    : 'custom';
  const selectedType = type === 'none' ? 'custom' : type;

  return {
    type: selectedType,
    customUrl:
      selected?.channel === 'local'
        ? baseUrlFromRemoteEntry(selected.remoteEntryUrl)
        : baseUrlFromRemoteEntry(production?.remoteEntryUrl ?? ''),
    productionKey: versionKeyOrEmpty(
      selectedType === 'production' && selected
        ? selected
        : (productionOptions[0] ?? production),
    ),
    prKey: versionKeyOrEmpty(
      selectedType === 'pr' && selected ? selected : prOptions[0],
    ),
  };
}

export function selectedManifest({
  production,
  draft,
  productionOptions,
  prOptions,
}: {
  production: Manifest;
  draft: EditorDraft;
  productionOptions: Manifest[];
  prOptions: Manifest[];
}): Manifest | undefined {
  if (draft.type === 'custom')
    return customManifest(production, draft.customUrl);
  if (draft.type === 'production')
    return productionOptions.find(
      (manifest) => versionKey(manifest) === draft.productionKey,
    );
  return prOptions.find((manifest) => versionKey(manifest) === draft.prKey);
}

export function customManifest(production: Manifest, rawUrl: string): Manifest {
  const baseUrl = normalizeBaseUrl(rawUrl);

  if (!baseUrl) throw new Error('Enter base URL.');

  try {
    const url = new URL(baseUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:')
      throw new Error();
  } catch {
    throw new Error('Base URL must be absolute HTTP URL.');
  }

  const manifest: Manifest = {
    ...production,
    version: CUSTOM_VERSION,
    buildId: CUSTOM_BUILD_ID,
    channel: 'local',
    remoteEntryUrl: `${baseUrl}/remoteEntry.json`,
    styles:
      production.framework === 'angular'
        ? [{ href: `${baseUrl}/styles.css` }]
        : [],
  };
  delete manifest.integrity;
  if (production.exportedWidgets) {
    manifest.exportedWidgets = production.exportedWidgets.map((widget) => ({
      ...widget,
      remoteEntryUrl: manifest.remoteEntryUrl,
    }));
  }
  return manifest;
}

export function normalizeStoredManifest(manifest: Manifest): Manifest {
  if (manifest.channel !== 'local' || manifest.version !== CUSTOM_BUILD_ID)
    return manifest;
  return { ...manifest, version: CUSTOM_VERSION };
}

export function productionVersions(
  hostData: HostData,
  production: Manifest,
): Manifest[] {
  const versions = hostData.versions[artifactKey(production)] ?? [];
  const historical = uniqueVersions(versions).filter(
    (manifest) =>
      manifest.channel === 'production' &&
      versionKey(manifest) !== versionKey(production),
  );
  return [production, ...historical];
}

export function prVersions(
  hostData: HostData,
  production: Manifest,
): Manifest[] {
  return uniqueVersions(
    hostData.versions[artifactKey(production)] ?? [],
  ).filter((manifest) => manifest.channel === 'pr');
}

export function overrideTypeFor(
  production: Manifest,
  selected: Manifest | undefined,
): OverrideType {
  if (!selected) return 'none';
  if (selected.channel === 'local') return 'custom';
  if (selected.channel === 'pr') return 'pr';
  if (versionKey(selected) === versionKey(production)) return 'none';
  return 'production';
}

export function badgeSkin(type: OverrideType): BadgeSkin {
  if (type === 'none') return 'neutralStandard';
  if (type === 'custom') return 'warning';
  if (type === 'pr') return 'premium';
  return 'standard';
}

export function versionLabel(manifest: Manifest): string {
  if (manifest.channel === 'pr') {
    return [
      manifest.gitBranch,
      manifest.gitSha?.slice(0, 7),
      manifest.gitCommitTitle,
    ]
      .filter((part): part is string => Boolean(part))
      .join(' · ');
  }
  const identity = `${manifest.version} · ${manifest.buildId.slice(0, 7)}`;
  if (manifest.channel === 'local') return `${identity} · Local`;
  return identity;
}

export function versionDisabled(manifest: Manifest, hostId: string): boolean {
  return !supportsHost(manifest, hostId);
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

function versionKeyOrEmpty(manifest: Manifest | undefined): string {
  return manifest ? versionKey(manifest) : '';
}

function selectedSourceDescription(selected: Manifest | undefined): string {
  if (!selected) return '';
  return selected.channel === 'pr'
    ? versionLabel(selected)
    : baseUrlFromRemoteEntry(selected.remoteEntryUrl);
}
