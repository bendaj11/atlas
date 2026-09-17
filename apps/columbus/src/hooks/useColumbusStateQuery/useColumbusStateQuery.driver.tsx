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
import type { loadColumbusState as loadColumbusStateType } from '../../utils/load-columbus-state/load-columbus-state';
import { createQueryClient } from '../../utils/query-client/query-client';

const loadColumbusState = jest.fn<typeof loadColumbusStateType>();

jest.unstable_mockModule(
  '../../utils/load-columbus-state/load-columbus-state',
  () => ({
    loadColumbusState,
  }),
);

const { useColumbusStateQuery } = await import('./useColumbusStateQuery');

export class ColumbusStateQueryDriver {
  private hook!: RenderHookResult<
    ReturnType<typeof useColumbusStateQuery>,
    undefined
  >;

  constructor() {
    jest.clearAllMocks();
  }

  readonly given = {
    columbusState: (columbusState: ColumbusState) => {
      loadColumbusState.mockResolvedValue(columbusState);

      return this;
    },
    loadFailure: (error: Error) => {
      loadColumbusState.mockRejectedValue(error);

      return this;
    },
  };

  readonly when = {
    rendered: async () => {
      const queryClient = createQueryClient();
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );
      this.hook = renderHook(() => useColumbusStateQuery(), { wrapper });
      await waitFor(() => expect(this.get.result().isFetching).toBe(false));
    },
    refetched: () => act(() => this.get.result().refetch()),
  };

  readonly get = {
    result: () => this.hook.result.current,
    loadColumbusState: () => loadColumbusState,
  };
}
