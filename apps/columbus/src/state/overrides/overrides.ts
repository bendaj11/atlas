import { failureMessage } from '../../scripts/shared/errors/errors';
import { persistColumbusState } from '../../scripts/overrides/persist-overrides';
import type { ColumbusState, OverrideStatus } from '../../types/app';

export async function persistOverrides(
  columbusState: ColumbusState,
): Promise<void> {
  try {
    await persistColumbusState(columbusState);
  } catch (error) {
    throw new Error(
      failureMessage(
        error,
        'apply the selected overrides',
        'Reload the Atlas host tab, reopen Columbus, verify the selected build is available, and retry.',
      ),
    );
  }
}

export function overrideStatusOf({
  isError,
  isPending,
}: {
  isError: boolean;
  isPending: boolean;
}): OverrideStatus {
  if (isPending) return 'APPLYING';

  return isError ? 'ERROR' : 'IDLE';
}

export function hasOverrides(
  columbusState: ColumbusState | undefined,
): boolean {
  if (!columbusState) return false;

  return (
    columbusState.enabledArtifactVersionOverrides.size > 0 ||
    columbusState.disabledArtifactVersionOverrides.size > 0
  );
}
