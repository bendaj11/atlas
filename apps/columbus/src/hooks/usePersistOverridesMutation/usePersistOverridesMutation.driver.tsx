import { jest } from '@jest/globals';
import { notifyManager, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, type RenderHookResult } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { ColumbusState } from '../../types/columbus-state';
import type { persistColumbusState as persistColumbusStateType } from '../../scripts/overrides/persist-overrides/persist-overrides';
import { createQueryClient } from '../../utils/query-client/query-client';
import { useColumbusStateMock } from '../../testkit/mocks/useColumbusState';

type ColumbusStateValue = ReturnType<typeof useColumbusStateMock>;

const persistColumbusState = jest.fn<typeof persistColumbusStateType>();

jest.unstable_mockModule('../../scripts/overrides/persist-overrides/persist-overrides', () => ({
  persistColumbusState,
}));

const { usePersistOverridesMutation } =
  await import('./usePersistOverridesMutation');

notifyManager.setScheduler((callback) => callback());

export class UsePersistOverridesMutationDriver {
  private readonly setColumbusState =
    jest.fn<ColumbusStateValue['setColumbusState']>();
  private readonly closeWindow = jest.spyOn(window, 'close');
  private readonly queryClient = createQueryClient();
  private hook!: RenderHookResult<
    ReturnType<typeof usePersistOverridesMutation>,
    undefined
  >;
  private otherHook!: RenderHookResult<
    ReturnType<typeof usePersistOverridesMutation>,
    undefined
  >;

  constructor() {
    jest.clearAllMocks();
    this.closeWindow.mockImplementation(() => {});
  }

  readonly given = {
    persist: (result: Promise<void>) => {
      persistColumbusState.mockReturnValue(result);

      return this;
    },
  };

  readonly when = {
    rendered: () => {
      useColumbusStateMock.mockReturnValue({
        columbusState: undefined,
        setColumbusState: this.setColumbusState,
      });
      this.hook = renderHook(() => usePersistOverridesMutation(), {
        wrapper: this.wrapper,
      });
    },
    renderedAgain: () => {
      this.otherHook = renderHook(() => usePersistOverridesMutation(), {
        wrapper: this.wrapper,
      });
    },
    mutated: (columbusState: ColumbusState) =>
      act(() =>
        this.get
          .result()
          .mutateAsync(columbusState)
          .catch(() => undefined),
      ),
    mutationStarted: (columbusState: ColumbusState) =>
      act(async () => {
        void this.get
          .result()
          .mutateAsync(columbusState)
          .catch(() => undefined);
      }),
  };

  private readonly wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={this.queryClient}>
      {children}
    </QueryClientProvider>
  );

  readonly get = {
    result: () => this.hook.result.current,
    otherResult: () => this.otherHook.result.current,
    persistColumbusState: () => persistColumbusState,
    setColumbusState: () => this.setColumbusState,
    closeWindow: () => this.closeWindow,
  };
}
