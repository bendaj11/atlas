import { jest } from '@jest/globals';
import { notifyManager, QueryClientProvider } from '@tanstack/react-query';
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

const { useHost } = await import('./useHost');

notifyManager.setScheduler((callback) => callback());

export class HostDriver {
  private hook!: RenderHookResult<ReturnType<typeof useHost>, undefined>;

  constructor() {
    jest.clearAllMocks();
  }

  readonly given = {
    columbusState: (columbusState: ColumbusState) => {
      loadColumbusState.mockResolvedValue(columbusState);

      return this;
    },
    columbusStateLoad: (load: Promise<ColumbusState>) => {
      loadColumbusState.mockReturnValue(load);

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
      this.hook = renderHook(() => useHost(), { wrapper });
      await waitFor(() => expect(this.get.result().status).not.toBe('LOADING'));
    },
    hostLoaded: () => act(() => this.get.result().loadHost()),
    hostLoadStarted: () =>
      act(async () => {
        void this.get.result().loadHost();
      }),
  };

  readonly get = {
    result: () => this.hook.result.current,
    loadColumbusState: () => loadColumbusState,
  };
}
