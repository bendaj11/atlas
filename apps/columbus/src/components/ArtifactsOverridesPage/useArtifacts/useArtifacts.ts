import { getArtifactKey } from '../../../types/contracts.js';
import { useSession } from '../../providers/index.js';
import {
  artifactSourceDescription,
  overrideTypeFor,
} from '../../../scripts/manifests/manifest-utils/manifest-utils.js';
import type { Artifact } from '../../../types/app.js';

export function useArtifacts(): Artifact[] {
  const { session } = useSession();
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
