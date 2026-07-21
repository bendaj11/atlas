import { getArtifactKey } from '../../contracts';
import { usePopupSession } from '../../context';
import {
  artifactSourceDescription,
  overrideTypeFor,
} from '../../popup/manifest-utils';
import type { Artifact } from '../../popup/types';

export function useArtifacts(): Artifact[] {
  const { session } = usePopupSession();
  if (!session) return [];

  const { activeOverrides, disabledOverrides, hostData } = session;
  const manifests = [
    hostData.catalog.host,
    ...hostData.catalog.apps,
    ...(hostData.catalog.widgetProviders ?? []),
  ];

  return manifests.map((productionManifest) => {
    const id = getArtifactKey(productionManifest);
    const selectedManifest =
      activeOverrides.get(id) ?? disabledOverrides.get(id);
    const runtimeError = hostData.runtimeErrors.find(
      (error) => error.artifactId === id,
    );
    const loadErrorSummary = runtimeError?.message
      .replace(/\s*\bRetry\b[.!]?\s*$/i, '')
      .trim();

    return {
      id,
      productionManifest,
      selectedManifest,
      overrideType: overrideTypeFor({
        productionManifest,
        selectedManifest,
      }),
      sourceDescription: artifactSourceDescription(selectedManifest),
      loadError: loadErrorSummary
        ? `${loadErrorSummary} Check override URL and server.`
        : undefined,
      overrideEnabled: activeOverrides.has(id),
      canToggle: Boolean(selectedManifest),
    };
  });
}
