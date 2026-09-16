import { useMutation } from '@tanstack/react-query';
import { useOverrides, useColumbusState } from '../../../state';
import {
  isArtifactVersionSupportedByHost,
  artifactVersionFromSelection,
} from '../../../scripts/artifact-versions/artifact-version-utils/artifact-version-utils';
import { loadArtifactVersionFromHostTab } from '../../../scripts/host/host-tabs/host-tabs';
import type {
  ArtifactConfiguration,
  OverrideSelection,
} from '../../../types/app';

export interface SaveArtifactOverrideMutationOptions {
  configuration: ArtifactConfiguration | undefined;
  selection: OverrideSelection;
}

export function useSaveArtifactOverrideMutation({
  configuration,
  selection,
}: SaveArtifactOverrideMutationOptions) {
  const { columbusState } = useColumbusState();
  const { saveOverride } = useOverrides();

  return useMutation<void, Error>({
    mutationFn: async () => {
      if (!configuration || !columbusState) return;

      const selected = artifactVersionFromSelection({
        ...configuration,
        selection,
      });
      const selectedArtifactVersion =
        selected.channel === 'local'
          ? selected
          : await loadArtifactVersionFromHostTab({
              tabId: columbusState.tabId,
              artifactKey: configuration.key,
              manifest: selected,
            });
      if (
        !isArtifactVersionSupportedByHost({
          artifactVersion: selectedArtifactVersion,
          hostId: configuration.hostId,
        })
      )
        throw new Error(
          'Selected artifact version does not support this host.',
        );

      await saveOverride({
        productionArtifactVersion: configuration.productionArtifactVersion,
        selectedArtifactVersion,
      });
    },
  });
}
