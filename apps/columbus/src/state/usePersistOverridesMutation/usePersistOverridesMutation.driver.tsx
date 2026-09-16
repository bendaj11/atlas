import { jest } from '@jest/globals';
import { notifyManager, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, type RenderHookResult } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { ColumbusState } from '../../types/app';
import type * as OverridesModule from '../overrides/overrides';
import type { useColumbusState as useColumbusStateType } from '../useColumbusState/useColumbusState';
import { createQueryClient } from '../query-client/query-client';

const persistOverrides =
  jest.fn<(typeof OverridesModule)['persistOverrides']>();
const useColumbusState = jest.fn<typeof useColumbusStateType>();

jest.unstable_mockModule('../overrides/overrides', () => ({
  persistOverrides,
}));
jest.unstable_mockModule('../useColumbusState/useColumbusState', () => ({
  useColumbusState,
}));

const { usePersistOverridesMutation } =
  await import('./usePersistOverridesMutation');

notifyManager.setScheduler((callback) => callback());

export class UsePersistOverridesMutationDriver {
  private readonly setColumbusState =
    jest.fn<ReturnType<typeof useColumbusStateType>['setColumbusState']>();
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
    persistOverrides.mockResolvedValue(undefined);
  }

  readonly given = {
    persistFailure: (reason: string): this => {
      persistOverrides.mockRejectedValue(new Error(reason));

      return this;
    },
    persistPending: (): this => {
      persistOverrides.mockReturnValue(new Promise(() => {}));

      return this;
    },
  };

  readonly when = {
    rendered: (): void => {
      useColumbusState.mockReturnValue({
        columbusState: undefined,
        setColumbusState: this.setColumbusState,
      });
      this.hook = renderHook(() => usePersistOverridesMutation(), {
        wrapper: this.wrapper,
      });
    },
    renderedAgain: (): void => {
      this.otherHook = renderHook(() => usePersistOverridesMutation(), {
        wrapper: this.wrapper,
      });
    },
    mutated: async (columbusState: ColumbusState): Promise<void> => {
      await act(() =>
        this.get
          .result()
          .mutateAsync(columbusState)
          .catch(() => undefined),
      );
    },
    mutationStarted: async (columbusState: ColumbusState): Promise<void> => {
      await act(async () => {
        void this.get
          .result()
          .mutateAsync(columbusState)
          .catch(() => undefined);
      });
    },
  };

  private readonly wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={this.queryClient}>
      {children}
    </QueryClientProvider>
  );

  readonly get = {
    result: () => this.hook.result.current,
    otherResult: () => this.otherHook.result.current,
    persistOverrides: () => persistOverrides,
    setColumbusState: () => this.setColumbusState,
    closeWindow: () => this.closeWindow,
  };
}
