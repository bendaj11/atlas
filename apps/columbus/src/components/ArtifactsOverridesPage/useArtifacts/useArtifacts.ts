import { useState } from 'react';
import { getArtifactKey } from '../../../types/contracts';
import { useColumbusState } from '../../providers';
import {
  artifactSourceDescription,
  overrideTypeFor,
} from '../../../scripts/artifact-versions/artifact-version-utils/artifact-version-utils';
import type {
  Artifact,
  ColumbusState,
  ArtifactVersion,
} from '../../../types/app';

interface Artifacts {
  artifacts: Artifact[];
  totalCount: number;
  searchValue: string;
  setSearchValue: (value: string) => void;
  visibleOnly: boolean;
  setVisibleOnly: (visibleOnly: boolean) => void;
}

export function useArtifacts(): Artifacts {
  const { columbusState } = useColumbusState();
  const [searchValue, setSearchValue] = useState('');
  const [visibleOnly, setVisibleOnly] = useState(false);
  const columbusStateArtifacts = columbusState
    ? createArtifacts(columbusState)
    : [];
  const visibilityFiltered = visibleOnly
    ? columbusStateArtifacts.filter((artifact) => artifact.visible)
    : columbusStateArtifacts;
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

function createArtifacts(columbusState: ColumbusState): Artifact[] {
  const { catalog } = columbusState.hostData;
  const artifactVersions = [
    catalog.host,
    ...catalog.apps,
    ...(catalog.widgetProviders ?? []),
  ];

  return artifactVersions.map((artifactVersion) =>
    createArtifact(artifactVersion, columbusState),
  );
}

function createArtifact(
  productionArtifactVersion: ArtifactVersion,
  {
    enabledArtifactVersionOverrides,
    disabledArtifactVersionOverrides,
    hostData,
  }: ColumbusState,
): Artifact {
  const key = getArtifactKey(productionArtifactVersion);
  const selectedArtifactVersion =
    enabledArtifactVersionOverrides.get(key) ??
    disabledArtifactVersionOverrides.get(key);

  return {
    key,
    productionArtifactVersion,
    selectedArtifactVersion,
    overrideType: overrideTypeFor({
      productionArtifactVersion,
      selectedArtifactVersion,
    }),
    sourceDescription: artifactSourceDescription(selectedArtifactVersion),
    loadError: loadErrorOf(key, hostData.runtimeErrors),
    overrideEnabled: enabledArtifactVersionOverrides.has(key),
    canToggle: Boolean(selectedArtifactVersion),
    visible: isVisible(productionArtifactVersion, hostData.visibleAppIds),
  };
}

function loadErrorOf(
  artifactKey: string,
  runtimeErrors: ColumbusState['hostData']['runtimeErrors'],
): string | undefined {
  const runtimeError = runtimeErrors.find(
    (error) => error.artifactId === artifactKey,
  );
  const summary = runtimeError?.message
    .replace(/\s*\bRetry\b[.!]?\s*$/i, '')
    .trim();

  return summary ? `${summary} Check override URL and server.` : undefined;
}

function isVisible(
  artifactVersion: ArtifactVersion,
  visibleAppIds: string[] = [],
): boolean {
  return (
    artifactVersion.kind === 'host' ||
    (artifactVersion.kind === 'app' &&
      visibleAppIds.includes(artifactVersion.id))
  );
}

function matchesSearch(artifact: Artifact, searchValue: string): boolean {
  const query = searchValue.trim().toLocaleLowerCase();
  if (!query) return true;

  return [
    artifact.productionArtifactVersion.name,
    artifact.sourceDescription,
  ].some((value) => value.toLocaleLowerCase().includes(query));
}

function overriddenArtifactsFirst(left: Artifact, right: Artifact): number {
  return (
    Number(right.overrideEnabled) - Number(left.overrideEnabled) ||
    Number(right.canToggle) - Number(left.canToggle)
  );
}
