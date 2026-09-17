import { useMutation } from '@tanstack/react-query';
import { useOverrides } from '../../../../hooks';
import {
  createCustomArtifactVersion,
  isArtifactVersionSupportedByHost,
} from '../../../../scripts/artifact-versions/artifact-version-utils/artifact-version-utils';
import type {
  ArtifactOverrideOptions,
  OverrideSelection,
} from '../../../../types/artifact';
import type { ArtifactVersion } from '../../../../types/artifact-version';

export interface SaveArtifactOverrideMutationOptions {
  overrideOptions: ArtifactOverrideOptions | undefined;
  hostId: string | undefined;
  selection: OverrideSelection;
  hostArtifactVersion: ArtifactVersion | undefined;
}

export function useSaveArtifactOverrideMutation({
  overrideOptions,
  hostId,
  selection,
  hostArtifactVersion,
}: SaveArtifactOverrideMutationOptions) {
  const { saveOverride } = useOverrides();

  return useMutation<void, Error>({
    mutationFn: async () => {
      if (!overrideOptions || !hostId) return;

      const selectedOverrideArtifactVersion =
        selection.type === 'custom'
          ? createCustomArtifactVersion({
              deployedArtifactVersion: overrideOptions.deployedArtifactVersion,
              rawUrl: selection.value,
            })
          : hostArtifactVersion;
      if (!selectedOverrideArtifactVersion)
        throw new Error('Selected artifact version is unavailable.');
      if (
        !isArtifactVersionSupportedByHost({
          artifactVersion: selectedOverrideArtifactVersion,
          hostId,
        })
      )
        throw new Error(
          'Selected artifact version does not support this host.',
        );

      await saveOverride({
        deployedArtifactVersion: overrideOptions.deployedArtifactVersion,
        selectedOverrideArtifactVersion,
      });
    },
  });
}
