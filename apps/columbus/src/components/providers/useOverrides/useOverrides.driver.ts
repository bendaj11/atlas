import { jest } from '@jest/globals';
import { act, renderHook, type RenderHookResult } from '@testing-library/react';
import type {
  Artifact,
  ColumbusState,
  OverrideStatus,
  Scope,
} from '../../../types/app';
import { aColumbusState } from '../../../types/app.testkit';
import type * as ArtifactVersionOverrideReducersModule from '../../../scripts/overrides/artifact-version-override-reducers/artifact-version-override-reducers';
import type * as OverridesModule from '../overrides/overrides';
import type { usePersistOverridesMutation as usePersistOverridesMutationType } from '../usePersistOverridesMutation/usePersistOverridesMutation';
import type { useColumbusState as useColumbusStateType } from '../useColumbusState/useColumbusState';

type ArtifactVersionOverrideReducers =
  typeof ArtifactVersionOverrideReducersModule;
type Overrides = typeof OverridesModule;
type MutationResult = ReturnType<typeof usePersistOverridesMutationType>;

const toggleArtifactVersionOverride =
  jest.fn<ArtifactVersionOverrideReducers['toggleArtifactVersionOverride']>();
const saveArtifactVersionOverride =
  jest.fn<ArtifactVersionOverrideReducers['saveArtifactVersionOverride']>();
const clearAllArtifactVersionOverrides =
  jest.fn<
    ArtifactVersionOverrideReducers['clearAllArtifactVersionOverrides']
  >();
const clearArtifactVersionOverride =
  jest.fn<ArtifactVersionOverrideReducers['clearArtifactVersionOverride']>();
const setArtifactVersionOverrideScope =
  jest.fn<ArtifactVersionOverrideReducers['setArtifactVersionOverrideScope']>();
const hasOverrides = jest.fn<Overrides['hasOverrides']>();
const overrideStatusOf = jest.fn<Overrides['overrideStatusOf']>();
const usePersistOverridesMutation =
  jest.fn<typeof usePersistOverridesMutationType>();
const useColumbusState = jest.fn<typeof useColumbusStateType>();

jest.unstable_mockModule(
  '../../../scripts/overrides/artifact-version-override-reducers/artifact-version-override-reducers',
  () => ({
    clearAllArtifactVersionOverrides,
    clearArtifactVersionOverride,
    saveArtifactVersionOverride,
    setArtifactVersionOverrideScope,
    toggleArtifactVersionOverride,
  }),
);
jest.unstable_mockModule('../overrides/overrides', () => ({
  hasOverrides,
  overrideStatusOf,
}));
jest.unstable_mockModule(
  '../usePersistOverridesMutation/usePersistOverridesMutation',
  () => ({ usePersistOverridesMutation }),
);
jest.unstable_mockModule('../useColumbusState/useColumbusState', () => ({
  useColumbusState,
}));

const { useOverrides } = await import('./useOverrides');

export class OverridesDriver {
  private columbusState: ColumbusState | undefined = aColumbusState();
  private readonly nextColumbusState = aColumbusState();
  private mutationError: Error | null = null;
  private mutationPending = false;
  private readonly setColumbusState =
    jest.fn<ReturnType<typeof useColumbusStateType>['setColumbusState']>();
  private readonly mutateAsync = jest.fn<MutationResult['mutateAsync']>();
  private hook!: RenderHookResult<ReturnType<typeof useOverrides>, undefined>;

  constructor() {
    jest.clearAllMocks();
    toggleArtifactVersionOverride.mockReturnValue(this.nextColumbusState);
    saveArtifactVersionOverride.mockReturnValue(this.nextColumbusState);
    clearAllArtifactVersionOverrides.mockReturnValue(this.nextColumbusState);
    clearArtifactVersionOverride.mockReturnValue(this.nextColumbusState);
    setArtifactVersionOverrideScope.mockReturnValue(this.nextColumbusState);
    hasOverrides.mockReturnValue(false);
    overrideStatusOf.mockReturnValue('IDLE');
    this.mutateAsync.mockResolvedValue(undefined);
  }

  readonly given = {
    columbusState: (columbusState: ColumbusState | undefined): this => {
      this.columbusState = columbusState;

      return this;
    },
    hasOverrides: (value: boolean): this => {
      hasOverrides.mockReturnValue(value);

      return this;
    },
    overrideStatus: (status: OverrideStatus): this => {
      overrideStatusOf.mockReturnValue(status);

      return this;
    },
    toggleResult: (columbusState: ColumbusState | undefined): this => {
      toggleArtifactVersionOverride.mockReturnValue(columbusState);

      return this;
    },
    mutationError: (error: Error | null): this => {
      this.mutationError = error;

      return this;
    },
    mutationPending: (pending: boolean): this => {
      this.mutationPending = pending;

      return this;
    },
    mutationFailure: (reason: string): this => {
      this.mutateAsync.mockRejectedValue(new Error(reason));

      return this;
    },
  };

  readonly when = {
    rendered: (): void => {
      useColumbusState.mockReturnValue({
        columbusState: this.columbusState,
        setColumbusState: this.setColumbusState,
      });
      usePersistOverridesMutation.mockReturnValue({
        error: this.mutationError,
        isError: this.mutationError !== null,
        isPending: this.mutationPending,
        mutateAsync: this.mutateAsync,
      } as Partial<MutationResult> as MutationResult);
      this.hook = renderHook(() => useOverrides());
    },
    overrideToggled: async (artifactKey: string): Promise<void> => {
      await act(() => this.get.result().toggleOverride(artifactKey));
    },
    overrideSaved: async (
      selection: Pick<
        Artifact,
        'productionArtifactVersion' | 'selectedArtifactVersion'
      >,
    ): Promise<void> => {
      await act(() => this.get.result().saveOverride(selection));
    },
    overrideCleared: async (artifactKey: string): Promise<void> => {
      await act(() => this.get.result().clearOverride(artifactKey));
    },
    allOverridesCleared: async (): Promise<void> => {
      await act(() => this.get.result().clearAllOverrides());
    },
    scopeSet: (scope: Scope): void => {
      act(() => this.get.result().setScope(scope));
    },
  };

  readonly get = {
    result: () => this.hook.result.current,
    nextColumbusState: (): ColumbusState => this.nextColumbusState,
    hasOverrides: () => hasOverrides,
    overrideStatusOf: () => overrideStatusOf,
    setColumbusState: () => this.setColumbusState,
    storedColumbusStateUpdate: (
      current: ColumbusState | undefined,
    ): unknown => {
      const update = this.setColumbusState.mock.calls.at(-1)?.[0] as (
        current: ColumbusState | undefined,
      ) => unknown;

      return update(current);
    },
    mutateAsync: () => this.mutateAsync,
    toggleArtifactVersionOverride: () => toggleArtifactVersionOverride,
    saveArtifactVersionOverride: () => saveArtifactVersionOverride,
    clearArtifactVersionOverride: () => clearArtifactVersionOverride,
    clearAllArtifactVersionOverrides: () => clearAllArtifactVersionOverrides,
  };
}
