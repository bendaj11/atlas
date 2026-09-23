import { useState } from 'react';
import { useColumbusState } from '../../../hooks';
import {
  baseUrlFromRemoteEntry,
  versionLabel,
} from '../../../utils/artifact-version-utils/artifact-version-utils';
import { versionKey } from '../../../utils/artifact-version-keys/artifact-version-keys';
import type {
  ArtifactOverride,
  ArtifactTableRow,
  OverrideType,
} from '../../../types/artifact';
import type { ColumbusState } from '../../../types/columbus-state';
import type { AtlasRuntimeError } from '../../../types/host-data';
import type { ArtifactVersion } from '../../../types/artifact-version';

interface Artifacts {
  artifacts: ArtifactTableRow[];
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

function createArtifacts(columbusState: ColumbusState): ArtifactTableRow[] {
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
  deployedArtifactVersion: ArtifactVersion,
  {
    enabledArtifactVersionOverrides,
    disabledArtifactVersionOverrides,
    hostData,
  }: ColumbusState,
): ArtifactTableRow {
  const key = deployedArtifactVersion.id;
  const selectedOverrideArtifactVersion =
    enabledArtifactVersionOverrides.get(key) ??
    disabledArtifactVersionOverrides.get(key);

  return {
    deployedArtifactVersion,
    selectedOverrideArtifactVersion,
    overrideType: overrideTypeFor({
      deployedArtifactVersion,
      selectedOverrideArtifactVersion,
    }),
    sourceDescription: artifactSourceDescription(
      selectedOverrideArtifactVersion,
    ),
    loadError: loadErrorOf(key, hostData.runtimeErrors),
    overrideEnabled: enabledArtifactVersionOverrides.has(key),
    canToggle: Boolean(selectedOverrideArtifactVersion),
    visible: isVisible(deployedArtifactVersion, hostData.visibleAppIds),
  };
}

function loadErrorOf(
  artifactKey: string,
  runtimeErrors: AtlasRuntimeError[],
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
  visibleAppIds: string[],
): boolean {
  return (
    artifactVersion.kind === 'host' ||
    (artifactVersion.kind === 'app' &&
      visibleAppIds.includes(artifactVersion.id))
  );
}

function matchesSearch(
  artifact: ArtifactTableRow,
  searchValue: string,
): boolean {
  const query = searchValue.trim().toLocaleLowerCase();
  if (!query) return true;

  return [
    artifact.deployedArtifactVersion.name,
    artifact.sourceDescription,
  ].some((value) => value.toLocaleLowerCase().includes(query));
}

function overriddenArtifactsFirst(
  left: ArtifactTableRow,
  right: ArtifactTableRow,
): number {
  return (
    Number(right.overrideEnabled) - Number(left.overrideEnabled) ||
    Number(right.canToggle) - Number(left.canToggle)
  );
}

function overrideTypeFor({
  deployedArtifactVersion,
  selectedOverrideArtifactVersion,
}: Pick<
  ArtifactOverride,
  'deployedArtifactVersion' | 'selectedOverrideArtifactVersion'
>): OverrideType | undefined {
  if (!selectedOverrideArtifactVersion) return undefined;
  if (selectedOverrideArtifactVersion.channel === 'local') return 'custom';
  if (selectedOverrideArtifactVersion.channel === 'pr') return 'pr';
  if (
    versionKey(selectedOverrideArtifactVersion) ===
    versionKey(deployedArtifactVersion)
  )
    return undefined;

  return 'production';
}

function artifactSourceDescription(
  selectedOverrideArtifactVersion: ArtifactVersion | undefined,
): string {
  if (!selectedOverrideArtifactVersion) return '';

  return selectedOverrideArtifactVersion.channel === 'local'
    ? baseUrlFromRemoteEntry(selectedOverrideArtifactVersion.remoteEntryUrl)
    : versionLabel(selectedOverrideArtifactVersion);
}
