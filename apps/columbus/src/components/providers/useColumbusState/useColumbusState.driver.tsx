import { jest } from '@jest/globals';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, type RenderHookResult } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { ColumbusState } from '../../../types/app';
import type { useColumbusStateQuery as useColumbusStateQueryType } from '../useColumbusStateQuery/useColumbusStateQuery';
import { createQueryClient } from '../query-client/query-client';

const useColumbusStateQuery = jest.fn<typeof useColumbusStateQueryType>();

jest.unstable_mockModule(
  '../useColumbusStateQuery/useColumbusStateQuery',
  () => ({
    useColumbusStateQuery,
  }),
);

const { useColumbusState } = await import('./useColumbusState');

type HookResult = ReturnType<typeof useColumbusState>;
type QueryResult = ReturnType<typeof useColumbusStateQueryType>;

export class ColumbusStateDriver {
  private readonly queryClient = createQueryClient();
  private columbusState: ColumbusState | undefined;
  private hook: RenderHookResult<HookResult, undefined> | undefined;

  constructor() {
    jest.clearAllMocks();
  }

  readonly given = {
    columbusState: (columbusState: ColumbusState | undefined): this => {
      this.columbusState = columbusState;

      return this;
    },
  };

  readonly when = {
    rendered: (): void => {
      useColumbusStateQuery.mockReturnValue({
        data: this.columbusState,
      } as QueryResult);
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={this.queryClient}>
          {children}
        </QueryClientProvider>
      );
      this.hook = renderHook(() => useColumbusState(), { wrapper });
    },
    columbusStateSet: (columbusState: ColumbusState): void => {
      act(() => this.get.result().setColumbusState(columbusState));
    },
    columbusStateUpdated: (
      update: (current: ColumbusState | undefined) => ColumbusState,
    ): void => {
      act(() => this.get.result().setColumbusState(update));
    },
  };

  readonly get = {
    result: (): HookResult => {
      if (!this.hook) throw new Error('Hook was not rendered.');

      return this.hook.result.current;
    },
    columbusState: (): ColumbusState | undefined =>
      this.get.result().columbusState,
    storedColumbusState: (): ColumbusState | undefined =>
      this.queryClient.getQueryData<ColumbusState>(['columbusState']),
  };
}
