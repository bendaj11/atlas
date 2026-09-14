import { useState } from 'react';
import { getArtifactKey } from '../../../types/contracts';
import { useSession } from '../../providers';
import {
  artifactSourceDescription,
  overrideTypeFor,
} from '../../../scripts/manifests/manifest-utils/manifest-utils';
import type { Artifact, ExtensionSession } from '../../../types/app';

interface Artifacts {
  artifacts: Artifact[];
  totalCount: number;
  searchValue: string;
  setSearchValue: (value: string) => void;
  visibleOnly: boolean;
  setVisibleOnly: (visibleOnly: boolean) => void;
}

export function useArtifacts(): Artifacts {
  const { session } = useSession();
  const [searchValue, setSearchValue] = useState('');
  const [visibleOnly, setVisibleOnly] = useState(false);
  const allArtifacts = session ? artifactsOf(session) : [];
  const displayed = visibleOnly
    ? allArtifacts.filter((artifact) => artifact.visible)
    : allArtifacts;
  const query = searchValue.trim().toLocaleLowerCase();
  const matching = query
    ? displayed.filter((artifact) =>
        [artifact.productionManifest.name, artifact.sourceDescription].some(
          (value) => value.toLocaleLowerCase().includes(query),
        ),
      )
    : displayed;

  return {
    artifacts: [...matching].sort(byOverrideRank),
    totalCount: displayed.length,
    searchValue,
    setSearchValue,
    visibleOnly,
    setVisibleOnly,
  };
}

function artifactsOf({
  activeOverrides,
  disabledOverrides,
  hostData,
}: ExtensionSession): Artifact[] {
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
      overrideType: overrideTypeFor({ productionManifest, selectedManifest }),
      sourceDescription: artifactSourceDescription(selectedManifest),
      loadError: loadErrorSummary
        ? `${loadErrorSummary} Check override URL and server.`
        : undefined,
      overrideEnabled: activeOverrides.has(id),
      canToggle: Boolean(selectedManifest),
      visible:
        productionManifest.kind === 'host' ||
        (productionManifest.kind === 'app' &&
          (hostData.visibleAppIds?.includes(productionManifest.id) ?? false)),
    };
  });
}

function byOverrideRank(left: Artifact, right: Artifact): number {
  return (
    Number(right.overrideEnabled) - Number(left.overrideEnabled) ||
    Number(right.canToggle) - Number(left.canToggle)
  );
}
