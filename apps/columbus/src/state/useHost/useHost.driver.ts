import { jest } from '@jest/globals';
import { act, renderHook, type RenderHookResult } from '@testing-library/react';
import type { ColumbusState } from '../../types/columbus-state';
import type { HostStatus } from '../columbus-state/columbus-state';
import type { useColumbusStateQuery as useColumbusStateQueryType } from '../useColumbusStateQuery/useColumbusStateQuery';
import type { hostStatusOf as hostStatusOfType } from '../columbus-state/columbus-state';

const useColumbusStateQuery = jest.fn<typeof useColumbusStateQueryType>();
const hostStatusOf = jest.fn<typeof hostStatusOfType>();

jest.unstable_mockModule(
  '../useColumbusStateQuery/useColumbusStateQuery',
  () => ({
    useColumbusStateQuery,
  }),
);
jest.unstable_mockModule('../columbus-state/columbus-state', () => ({
  hostStatusOf,
}));

const { useHost } = await import('./useHost');

type HookResult = ReturnType<typeof useHost>;
type QueryResult = ReturnType<typeof useColumbusStateQueryType>;

export class HostDriver {
  private columbusState: ColumbusState | undefined;
  private error: Error | undefined;
  private isError = false;
  private isFetching = false;
  private readonly refetch = jest.fn<QueryResult['refetch']>();
  private hook: RenderHookResult<HookResult, undefined> | undefined;

  constructor() {
    jest.clearAllMocks();
    this.refetch.mockResolvedValue(
      {} as Awaited<ReturnType<QueryResult['refetch']>>,
    );
  }

  readonly given = {
    columbusState: (columbusState: ColumbusState | undefined): this => {
      this.columbusState = columbusState;

      return this;
    },
    error: (error: Error | undefined): this => {
      this.error = error;
      this.isError = error !== undefined;

      return this;
    },
    fetching: (isFetching: boolean): this => {
      this.isFetching = isFetching;

      return this;
    },
    hostStatus: (status: HostStatus): this => {
      hostStatusOf.mockReturnValue(status);

      return this;
    },
  };

  readonly when = {
    rendered: (): void => {
      useColumbusStateQuery.mockReturnValue({
        data: this.columbusState,
        error: this.error,
        isError: this.isError,
        isFetching: this.isFetching,
        refetch: this.refetch,
      } as Partial<QueryResult> as QueryResult);
      this.hook = renderHook(() => useHost());
    },
    hostLoaded: async (): Promise<void> => {
      await act(() => this.get.result().loadHost());
    },
  };

  readonly get = {
    result: (): HookResult => {
      if (!this.hook) throw new Error('Hook was not rendered.');

      return this.hook.result.current;
    },
    hostData: () => this.get.result().hostData,
    status: (): HostStatus => this.get.result().status,
    message: (): string => this.get.result().message,
    hostStatusRequest: () => hostStatusOf.mock.calls[0]?.[0],
    refetchCount: (): number => this.refetch.mock.calls.length,
  };
}
