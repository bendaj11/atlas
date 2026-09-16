import {
  clearAllArtifactVersionOverrides,
  clearArtifactVersionOverride,
  saveArtifactVersionOverride,
  setArtifactVersionOverrideScope,
  toggleArtifactVersionOverride,
} from '../../scripts/overrides/artifact-version-override-reducers/artifact-version-override-reducers';
import type { Artifact } from '../../types/artifact';
import type { ColumbusState, Scope } from '../../types/columbus-state';
import type { OverrideStatus } from '../overrides/overrides';
import { hasOverrides, overrideStatusOf } from '../overrides/overrides';
import { usePersistOverridesMutation } from '../usePersistOverridesMutation/usePersistOverridesMutation';
import { useColumbusState } from '../useColumbusState/useColumbusState';

interface OverridesValue {
  hasOverrides: boolean;
  scope: Scope;
  status: OverrideStatus;
  message: string;
  clearAllOverrides: () => Promise<void>;
  clearOverride: (artifactKey: string) => Promise<void>;
  saveOverride: (
    selection: Pick<
      Artifact,
      'productionArtifactVersion' | 'selectedArtifactVersion'
    >,
  ) => Promise<void>;
  setScope: (scope: Scope) => void;
  toggleOverride: (artifactKey: string) => Promise<void>;
}

export function useOverrides(): OverridesValue {
  const { columbusState, setColumbusState } = useColumbusState();
  const { error, isError, isPending, mutateAsync } =
    usePersistOverridesMutation();

  async function applyToColumbusState(
    transform: (columbusState: ColumbusState) => ColumbusState | undefined,
  ): Promise<void> {
    if (!columbusState || isPending) return;

    const nextColumbusState = transform(columbusState);
    if (!nextColumbusState) return;

    await mutateAsync(nextColumbusState).catch(() => undefined);
  }

  return {
    hasOverrides: hasOverrides(columbusState),
    scope: columbusState?.scope ?? 'all',
    status: overrideStatusOf({ isError, isPending }),
    message: error?.message ?? '',
    clearAllOverrides: () =>
      applyToColumbusState(clearAllArtifactVersionOverrides),
    clearOverride: (artifactKey) =>
      applyToColumbusState((current) =>
        clearArtifactVersionOverride({ columbusState: current, artifactKey }),
      ),
    saveOverride: (selection) =>
      applyToColumbusState((current) =>
        saveArtifactVersionOverride({ columbusState: current, selection }),
      ),
    setScope: (scope) =>
      setColumbusState((current) =>
        current
          ? setArtifactVersionOverrideScope({ columbusState: current, scope })
          : current,
      ),
    toggleOverride: (artifactKey) =>
      applyToColumbusState((current) =>
        toggleArtifactVersionOverride({ columbusState: current, artifactKey }),
      ),
  };
}
