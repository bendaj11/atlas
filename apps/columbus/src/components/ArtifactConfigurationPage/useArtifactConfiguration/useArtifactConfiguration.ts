import { useLocation } from 'react-router-dom';
import { useColumbusState } from '../../../state';
import { configurationOf } from '../../../scripts/artifact-versions/artifact-version-utils/artifact-version-utils';
import type { Artifact } from '../../../types/artifact';

export function useArtifactConfiguration() {
  const { state } = useLocation();
  const { columbusState } = useColumbusState();
  const artifact = (state as { artifact: Artifact } | null)?.artifact;

  return artifact && columbusState
    ? configurationOf(artifact, columbusState)
    : undefined;
}
