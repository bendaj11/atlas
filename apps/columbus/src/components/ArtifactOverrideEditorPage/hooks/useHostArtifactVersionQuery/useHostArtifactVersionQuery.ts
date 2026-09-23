import { skipToken, useQuery } from '@tanstack/react-query';
import { useColumbusState } from '../../../../hooks';
import { versionKey } from '../../../../utils/artifact-version-keys/artifact-version-keys';
import { loadArtifactVersionFromHostTab } from '../../../../utils/host-tabs/host-tabs';
import type {
  ArtifactOverrideOptions,
  OverrideSelection,
} from '../../../../types/artifact';
import type { ArtifactVersion } from '../../../../types/artifact-version';

export interface HostArtifactVersionQueryOptions {
  overrideOptions: ArtifactOverrideOptions | undefined;
  selection: OverrideSelection;
}

export function useHostArtifactVersionQuery({
  overrideOptions,
  selection,
}: HostArtifactVersionQueryOptions) {
  const { columbusState } = useColumbusState();

  return useQuery<ArtifactVersion, Error>({
    queryKey: [
      'host-artifact-version',
      columbusState?.tabId,
      overrideOptions?.deployedArtifactVersion.id,
      selection.type,
      selection.value,
    ],
    queryFn:
      overrideOptions && columbusState && selection.type !== 'custom'
        ? () =>
            loadArtifactVersionFromHostTab({
              tabId: columbusState.tabId,
              manifest: artifactVersionFromSelection({
                overrideOptions,
                selection,
              }),
            })
        : skipToken,
  });
}

function artifactVersionFromSelection({
  overrideOptions: { productionArtifactVersions, prArtifactVersions },
  selection,
}: {
  overrideOptions: ArtifactOverrideOptions;
  selection: OverrideSelection;
}): ArtifactVersion {
  const artifactVersions =
    selection.type === 'production'
      ? productionArtifactVersions
      : prArtifactVersions;
  const artifactVersion = artifactVersions.find(
    (candidate) => versionKey(candidate) === selection.value,
  );
  if (!artifactVersion)
    throw new Error(
      selection.type === 'production'
        ? 'Choose a production version.'
        : 'Choose a PR version.',
    );

  return artifactVersion;
}
