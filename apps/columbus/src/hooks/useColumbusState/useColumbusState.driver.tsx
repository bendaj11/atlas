import { jest } from '@jest/globals';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  renderHook,
  type RenderHookResult,
  waitFor,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import type { ColumbusState } from '../../types/columbus-state';
import { aColumbusState } from '../../testkit/columbus-state.testkit';
import type { loadColumbusState as loadColumbusStateType } from '../../utils/load-columbus-state/load-columbus-state';
import { createQueryClient } from '../../utils/query-client/query-client';

const loadColumbusState = jest.fn<typeof loadColumbusStateType>();

jest.unstable_mockModule(
  '../../utils/load-columbus-state/load-columbus-state',
  () => ({
    loadColumbusState,
  }),
);

const { useColumbusState } = await import('./useColumbusState');

export class ColumbusStateDriver {
  private readonly queryClient = createQueryClient();
  private hook!: RenderHookResult<
    ReturnType<typeof useColumbusState>,
    undefined
  >;

  constructor() {
    jest.clearAllMocks();
    loadColumbusState.mockResolvedValue(aColumbusState());
  }

  readonly given = {
    columbusState: (columbusState: ColumbusState) => {
      loadColumbusState.mockResolvedValue(columbusState);

      return this;
    },
  };

  readonly when = {
    rendered: async () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={this.queryClient}>
          {children}
        </QueryClientProvider>
      );
      this.hook = renderHook(() => useColumbusState(), { wrapper });
      await waitFor(() =>
        expect(this.get.result().columbusState).toBeDefined(),
      );
    },
    columbusStateSet: (columbusState: ColumbusState) =>
      act(() => this.get.result().setColumbusState(columbusState)),
    columbusStateUpdated: (
      update: (current: ColumbusState | undefined) => ColumbusState,
    ) => act(() => this.get.result().setColumbusState(update)),
  };

  readonly get = {
    result: () => this.hook.result.current,
    storedColumbusState: () =>
      this.queryClient.getQueryData<ColumbusState>(['columbusState']),
  };
}
