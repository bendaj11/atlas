import { jest } from '@jest/globals';
import { faker } from '@faker-js/faker';
import { act, renderHook, type RenderHookResult } from '@testing-library/react';
import type { ArtifactOverride } from '../../types/artifact';
import type { ColumbusState, Scope } from '../../types/columbus-state';
import { aColumbusState } from '../../testkit/columbus-state.testkit';
import type { usePersistOverridesMutation as usePersistOverridesMutationType } from '../usePersistOverridesMutation/usePersistOverridesMutation';
import { useColumbusStateMock } from '../../testkit/mocks/useColumbusState';

type ColumbusStateValue = ReturnType<typeof useColumbusStateMock>;
type MutationResult = ReturnType<typeof usePersistOverridesMutationType>;

const usePersistOverridesMutation =
  jest.fn<typeof usePersistOverridesMutationType>();

jest.unstable_mockModule(
  '../usePersistOverridesMutation/usePersistOverridesMutation',
  () => ({ usePersistOverridesMutation }),
);

const { useOverrides } = await import('./useOverrides');

export class OverridesDriver {
  private columbusState: ColumbusState | undefined = aColumbusState();
  private mutationError: Error | null = faker.helpers.arrayElement([
    null,
    new Error(faker.lorem.sentence()),
  ]);
  private mutationPending = faker.datatype.boolean();
  private readonly setColumbusState =
    jest.fn<ColumbusStateValue['setColumbusState']>();
  private readonly mutateAsync = jest.fn<MutationResult['mutateAsync']>();
  private hook!: RenderHookResult<ReturnType<typeof useOverrides>, undefined>;

  constructor() {
    jest.clearAllMocks();
  }

  readonly given = {
    columbusState: (columbusState: ColumbusState | undefined) => {
      this.columbusState = columbusState;

      return this;
    },
    mutationError: (error: Error | null) => {
      this.mutationError = error;

      return this;
    },
    mutationPending: (pending: boolean) => {
      this.mutationPending = pending;

      return this;
    },
    mutation: (result: Promise<void>) => {
      this.mutateAsync.mockReturnValue(result);

      return this;
    },
  };

  readonly when = {
    rendered: () => {
      useColumbusStateMock.mockReturnValue({
        columbusState: this.columbusState,
        setColumbusState: this.setColumbusState,
      });
      usePersistOverridesMutation.mockReturnValue({
        error: this.mutationError,
        isError: this.mutationError !== null,
        isPending: this.mutationPending,
        mutateAsync: this.mutateAsync,
      });
      this.hook = renderHook(() => useOverrides());
    },
    overrideToggled: (artifactKey: string) =>
      act(() => this.get.result().toggleOverride(artifactKey)),
    overrideSaved: (
      selection: Pick<
        ArtifactOverride,
        'deployedArtifactVersion' | 'selectedOverrideArtifactVersion'
      >,
    ) => act(() => this.get.result().saveOverride(selection)),
    overrideCleared: (artifactKey: string) =>
      act(() => this.get.result().clearOverride(artifactKey)),
    allOverridesCleared: () => act(() => this.get.result().clearAllOverrides()),
    scopeSet: (scope: Scope) => act(() => this.get.result().setScope(scope)),
  };

  readonly get = {
    result: () => this.hook.result.current,
    mutateAsync: () => this.mutateAsync,
    storedColumbusStateUpdate: (current: ColumbusState | undefined) => {
      const update = this.setColumbusState.mock.lastCall?.[0];

      return typeof update === 'function' ? update(current) : update;
    },
  };
}
