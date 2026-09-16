import { useOverrides } from '../../../../state';
import { failureMessage } from '../../../../scripts/shared/errors/errors';
import {
  type SaveArtifactOverrideMutationOptions,
  useSaveArtifactOverrideMutation,
} from '../useSaveArtifactOverrideMutation/useSaveArtifactOverrideMutation';

export function useSaveArtifactOverride(
  options: SaveArtifactOverrideMutationOptions,
) {
  const { configuration } = options;
  const { message: overrideMessage, saveOverride, status } = useOverrides();
  const { error, isPending, mutateAsync } =
    useSaveArtifactOverrideMutation(options);

  function clearOverride(): Promise<void> {
    if (!configuration) return Promise.resolve();

    return saveOverride({
      productionArtifactVersion: configuration.productionArtifactVersion,
      selectedArtifactVersion: undefined,
    });
  }

  function errorMessage(): string | undefined {
    if (error)
      return failureMessage(
        error,
        'save this artifact override',
        'Correct the selected version or URL, then retry.',
      );

    return status === 'ERROR' ? overrideMessage : undefined;
  }

  return {
    clearOverride,
    errorMessage: errorMessage(),
    loading: isPending,
    save: () => mutateAsync().catch(() => undefined),
  };
}
