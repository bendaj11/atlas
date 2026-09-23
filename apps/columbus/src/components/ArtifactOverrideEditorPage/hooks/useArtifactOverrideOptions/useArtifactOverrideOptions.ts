import { useLocation } from 'react-router-dom';
import { useColumbusState } from '../../../../hooks';
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
  const { state }: { state: ArtifactOverrideLocationState | null } =
    useLocation();
  const { columbusState } = useColumbusState();
  const artifact = state?.artifact;

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
