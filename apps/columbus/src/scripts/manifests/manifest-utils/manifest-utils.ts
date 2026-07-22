import { type AtlasExtensionManifest as Manifest } from '../../../types/contracts.js';
import {
  supportsHost,
  versionKey,
} from '../manifest-versions/manifest-versions.js';
import { CUSTOM_BUILD_ID, CUSTOM_VERSION } from '../../shared/constants.js';
import type { BadgeSkin } from '@wix/design-system';
import type {
  ArtifactConfiguration,
  ArtifactSelection,
  EditorDraft,
  OverrideType,
} from '../../../types/app.js';

interface ResolveSelectedManifestOptions extends Pick<
  ArtifactConfiguration,
  'productionManifest' | 'productionOptions' | 'prOptions'
> {
  draft: EditorDraft;
}

interface CreateCustomManifestOptions extends Pick<
  ArtifactSelection,
  'productionManifest'
> {
  rawUrl: string;
}

export function createEditorDraft(
  configuration: ArtifactConfiguration | undefined,
): EditorDraft {
  const productionManifest = configuration?.productionManifest;
  const selectedManifest = configuration?.selectedManifest;
  const type = selectedManifest
    ? overrideTypeFor({
        productionManifest: productionManifest ?? selectedManifest,
        selectedManifest,
      })
    : 'custom';
  const selectedType = type === 'none' ? 'custom' : type;

  return {
    type: selectedType,
    customUrl:
      selectedManifest?.channel === 'local'
        ? baseUrlFromRemoteEntry(selectedManifest.remoteEntryUrl)
        : '',
    productionKey: versionKeyOrEmpty(
      selectedType === 'production' && selectedManifest
        ? selectedManifest
        : (configuration?.productionOptions[0] ?? productionManifest),
    ),
    prKey: versionKeyOrEmpty(
      selectedType === 'pr' && selectedManifest
        ? selectedManifest
        : configuration?.prOptions[0],
    ),
  };
}

export function resolveSelectedManifest({
  productionManifest,
  draft,
  productionOptions,
  prOptions,
}: ResolveSelectedManifestOptions): Manifest | undefined {
  if (draft.type === 'custom')
    return createCustomManifest({
      productionManifest,
      rawUrl: draft.customUrl,
    });
  if (draft.type === 'production') {
    const selectedManifest = productionOptions.find(
      (manifest) => versionKey(manifest) === draft.productionKey,
    );
    if (!selectedManifest) throw new Error('Choose a production version.');
    return selectedManifest;
  }

  const selectedManifest = prOptions.find(
    (manifest) => versionKey(manifest) === draft.prKey,
  );
  if (!selectedManifest) throw new Error('Choose a PR version.');
  return selectedManifest;
}

export function createCustomManifest({
  productionManifest,
  rawUrl,
}: CreateCustomManifestOptions): Manifest {
  const baseUrl = validatedBaseUrl(rawUrl);

  const manifest: Manifest = {
    ...productionManifest,
    version: CUSTOM_VERSION,
    buildId: CUSTOM_BUILD_ID,
    channel: 'local',
    remoteEntryUrl: `${baseUrl}/remoteEntry.json`,
    styles:
      productionManifest.framework === 'angular'
        ? [{ href: `${baseUrl}/styles.css` }]
        : [],
  };
  delete manifest.integrity;
  if (productionManifest.exportedWidgets) {
    manifest.exportedWidgets = productionManifest.exportedWidgets.map(
      (widget) => ({
        ...widget,
        remoteEntryUrl: manifest.remoteEntryUrl,
      }),
    );
  }
  return manifest;
}

export function normalizeStoredManifest(manifest: Manifest): Manifest {
  if (manifest.channel !== 'local' || manifest.version !== CUSTOM_BUILD_ID)
    return manifest;
  return { ...manifest, version: CUSTOM_VERSION };
}

export function overrideTypeFor({
  productionManifest,
  selectedManifest,
}: ArtifactSelection): OverrideType {
  if (!selectedManifest) return 'none';
  if (selectedManifest.channel === 'local') return 'custom';
  if (selectedManifest.channel === 'pr') return 'pr';
  if (versionKey(selectedManifest) === versionKey(productionManifest))
    return 'none';
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
  if (manifest.channel === 'production') return manifest.version;

  const identity = `${manifest.version} · ${manifest.buildId.slice(0, 7)}`;
  return `${identity} · Local`;
}

export function versionDisabled({
  manifest,
  hostId,
}: {
  manifest: Manifest;
  hostId: string;
}): boolean {
  return !supportsHost({ manifest, hostId });
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
  if (url.username || url.password)
    throw new Error('Base URL must not include credentials.');
  if (url.search || url.hash)
    throw new Error(
      'Base URL must not include query parameters or a fragment.',
    );

  return url.href.replace(/\/$/u, '');
}

function versionKeyOrEmpty(manifest: Manifest | undefined): string {
  return manifest ? versionKey(manifest) : '';
}

export function artifactSourceDescription(
  selectedManifest: Manifest | undefined,
): string {
  if (!selectedManifest) return '';
  return selectedManifest.channel === 'local'
    ? baseUrlFromRemoteEntry(selectedManifest.remoteEntryUrl)
    : versionLabel(selectedManifest);
}
