import {
  artifactKey,
  type AtlasExtensionManifest as Manifest,
  type AtlasHostData as HostData,
} from '../contracts.js';
import {
  createAppViewModel,
  prVersions,
  productionVersions,
} from './manifest-utils.js';
import type { AppViewModel, EditorModel } from './types.js';

export function createArtifactViewModels(
  manifests: readonly Manifest[],
  activeOverrides: ReadonlyMap<string, Manifest>,
  disabledOverrides: ReadonlyMap<string, Manifest>,
): AppViewModel[] {
  return manifests.map((manifest) =>
    createAppViewModel(manifest, activeOverrides, disabledOverrides),
  );
}

export function createArtifactConfigurationViewModel(
  selectedArtifactKey: string | undefined,
  hostData: HostData | undefined,
  activeOverrides: ReadonlyMap<string, Manifest>,
  disabledOverrides: ReadonlyMap<string, Manifest>,
): EditorModel | undefined {
  if (!selectedArtifactKey || !hostData) return undefined;

  const productionManifest = [
    hostData.catalog.host,
    ...hostData.catalog.apps,
    ...(hostData.catalog.widgetProviders ?? []),
  ].find((manifest) => artifactKey(manifest) === selectedArtifactKey);
  if (!productionManifest) return undefined;

  return {
    hostId: hostData.config.hostId,
    allowCustomOverrides: hostData.config.allowCustomOverrides ?? false,
    production: productionManifest,
    selected:
      activeOverrides.get(selectedArtifactKey) ??
      disabledOverrides.get(selectedArtifactKey),
    productionOptions: productionVersions(hostData, productionManifest),
    prOptions: prVersions(hostData, productionManifest),
  };
}
