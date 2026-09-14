import { useState } from 'react';
import { getArtifactKey } from '../../../types/contracts';
import { useSession } from '../../providers';
import {
  artifactSourceDescription,
  overrideTypeFor,
} from '../../../scripts/manifests/manifest-utils/manifest-utils';
import type { Artifact, ExtensionSession, Manifest } from '../../../types/app';

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
  const sessionArtifacts = session ? createArtifacts(session) : [];
  const visibilityFiltered = visibleOnly
    ? sessionArtifacts.filter((artifact) => artifact.visible)
    : sessionArtifacts;
  const searchFiltered = visibilityFiltered.filter((artifact) =>
    matchesSearch(artifact, searchValue),
  );

  return {
    artifacts: searchFiltered.sort(overriddenArtifactsFirst),
    totalCount: visibilityFiltered.length,
    searchValue,
    setSearchValue,
    visibleOnly,
    setVisibleOnly,
  };
}

function createArtifacts(session: ExtensionSession): Artifact[] {
  const { catalog } = session.hostData;
  const manifests = [
    catalog.host,
    ...catalog.apps,
    ...(catalog.widgetProviders ?? []),
  ];

  return manifests.map((manifest) => createArtifact(manifest, session));
}

function createArtifact(
  productionManifest: Manifest,
  { activeOverrides, disabledOverrides, hostData }: ExtensionSession,
): Artifact {
  const key = getArtifactKey(productionManifest);
  const selectedManifest =
    activeOverrides.get(key) ?? disabledOverrides.get(key);

  return {
    key,
    productionManifest,
    selectedManifest,
    overrideType: overrideTypeFor({ productionManifest, selectedManifest }),
    sourceDescription: artifactSourceDescription(selectedManifest),
    loadError: loadErrorOf(key, hostData.runtimeErrors),
    overrideEnabled: activeOverrides.has(key),
    canToggle: Boolean(selectedManifest),
    visible: isVisible(productionManifest, hostData.visibleAppIds),
  };
}

function loadErrorOf(
  artifactKey: string,
  runtimeErrors: ExtensionSession['hostData']['runtimeErrors'],
): string | undefined {
  const runtimeError = runtimeErrors.find(
    (error) => error.artifactId === artifactKey,
  );
  const summary = runtimeError?.message
    .replace(/\s*\bRetry\b[.!]?\s*$/i, '')
    .trim();

  return summary ? `${summary} Check override URL and server.` : undefined;
}

function isVisible(manifest: Manifest, visibleAppIds: string[] = []): boolean {
  return (
    manifest.kind === 'host' ||
    (manifest.kind === 'app' && visibleAppIds.includes(manifest.id))
  );
}

function matchesSearch(artifact: Artifact, searchValue: string): boolean {
  const query = searchValue.trim().toLocaleLowerCase();
  if (!query) return true;

  return [artifact.productionManifest.name, artifact.sourceDescription].some(
    (value) => value.toLocaleLowerCase().includes(query),
  );
}

function overriddenArtifactsFirst(left: Artifact, right: Artifact): number {
  return (
    Number(right.overrideEnabled) - Number(left.overrideEnabled) ||
    Number(right.canToggle) - Number(left.canToggle)
  );
}
