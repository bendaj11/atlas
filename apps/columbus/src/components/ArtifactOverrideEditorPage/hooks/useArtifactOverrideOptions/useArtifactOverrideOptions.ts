import { useLocation } from 'react-router-dom';
import { useColumbusState } from '../../../../hooks';
import { isRecord } from '../../../../utils/messages/messages';
import { uniqueVersions } from '../../../../utils/artifact-version-keys/artifact-version-keys';
import type {
  ArtifactOverrideOptions,
  ArtifactTableRow,
} from '../../../../types/artifact';

interface ArtifactOverrideLocationState {
  artifact: ArtifactTableRow;
}

export function useArtifactOverrideOptions():
  ArtifactOverrideOptions | undefined {
  const location = useLocation();
  const state: unknown = location.state;
  const { columbusState } = useColumbusState();
  const artifact = isArtifactOverrideLocationState(state)
    ? state.artifact
    : undefined;

  if (!artifact || !columbusState) return undefined;

  const { deployedArtifactVersion, overrideEnabled } = artifact;
  const {
    enabledArtifactVersionOverrides,
    disabledArtifactVersionOverrides,
    hostData,
  } = columbusState;
  const key = deployedArtifactVersion.id;
  const versions = uniqueVersions([
    ...(hostData.versions[key] ?? []),
    deployedArtifactVersion,
  ]);

  return {
    deployedArtifactVersion,
    overrideEnabled,
    selectedOverrideArtifactVersion:
      enabledArtifactVersionOverrides.get(key) ??
      disabledArtifactVersionOverrides.get(key),
    productionArtifactVersions: versions.filter(
      (artifactVersion) => artifactVersion.channel === 'production',
    ),
    prArtifactVersions: versions.filter(
      (artifactVersion) => artifactVersion.channel === 'pr',
    ),
  };
}

function isArtifactOverrideLocationState(
  value: unknown,
): value is ArtifactOverrideLocationState {
  return (
    isRecord(value) &&
    isRecord(value.artifact) &&
    isRecord(value.artifact.deployedArtifactVersion) &&
    typeof value.artifact.overrideEnabled === 'boolean'
  );
}
