import { jest } from '@jest/globals';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  renderHook,
  type RenderHookResult,
  waitFor,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import type { ColumbusState } from '../../types/app';
import type { loadColumbusState as loadColumbusStateType } from '../columbus-state/columbus-state';
import { createQueryClient } from '../query-client/query-client';

const loadColumbusState = jest.fn<typeof loadColumbusStateType>();

jest.unstable_mockModule('../columbus-state/columbus-state', () => ({
  loadColumbusState,
  COLUMBUS_STATE_QUERY_KEY: ['columbusState'],
}));

const { useColumbusStateQuery } = await import('./useColumbusStateQuery');

type HookResult = ReturnType<typeof useColumbusStateQuery>;

export class ColumbusStateQueryDriver {
  private hook: RenderHookResult<HookResult, undefined> | undefined;

  constructor() {
    jest.clearAllMocks();
  }

  readonly given = {
    columbusState: (columbusState: ColumbusState): this => {
      loadColumbusState.mockResolvedValue(columbusState);

      return this;
    },
    loadFailure: (reason: string): this => {
      loadColumbusState.mockRejectedValue(new Error(reason));

      return this;
    },
  };

  readonly when = {
    rendered: async (): Promise<void> => {
      const queryClient = createQueryClient();
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );
      this.hook = renderHook(() => useColumbusStateQuery(), { wrapper });
      await waitFor(() => expect(this.get.result().isFetching).toBe(false));
    },
    refetched: async (): Promise<void> => {
      await act(async () => {
        await this.get.result().refetch();
      });
    },
  };

  readonly get = {
    result: (): HookResult => {
      if (!this.hook) throw new Error('Hook was not rendered.');

      return this.hook.result.current;
    },
    columbusState: (): ColumbusState | undefined => this.get.result().data,
    errorMessage: (): string | undefined => this.get.result().error?.message,
    loadRequests: (): boolean[] =>
      loadColumbusState.mock.calls.map(
        ([hasColumbusState]) => hasColumbusState,
      ),
  };
}
