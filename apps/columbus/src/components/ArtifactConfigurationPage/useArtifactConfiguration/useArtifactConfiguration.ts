import { useLocation } from 'react-router-dom';
import { useColumbusState } from '../../providers';
import { configurationOf } from '../../../scripts/artifact-versions/artifact-version-utils/artifact-version-utils';
import type { ArtifactProps } from '../../../types/app';

export function useArtifactConfiguration() {
  const { state } = useLocation();
  const { columbusState } = useColumbusState();
  const artifact = (state as ArtifactProps | null)?.artifact;

  return artifact && columbusState
    ? configurationOf(artifact, columbusState)
    : undefined;
}
