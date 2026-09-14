import { expect, jest } from '@jest/globals';
import {
  act,
  renderHook,
  type RenderHookResult,
  waitFor,
} from '@testing-library/react';
import type { ExtensionSession, Manifest } from '../../../types/app';
import type { AtlasHostData as HostData } from '../../../types/contracts';
import {
  type readDisabledOverrides as readDisabledOverridesType,
  type readHostData as readHostDataType,
  type readSuppressedArtifactIds as readSuppressedArtifactIdsType,
} from '../../../scripts/host/atlas-host/atlas-host';
import type { readHostDataCache as readHostDataCacheType } from '../../../scripts/host/host-data-cache';
import type { useSession as useSessionType } from '../SessionContext/SessionContext';

const readHostData = jest.fn<typeof readHostDataType>();
const readDisabledOverrides = jest.fn<typeof readDisabledOverridesType>();
const readSuppressedArtifactIds =
  jest.fn<typeof readSuppressedArtifactIdsType>();
const readHostDataCache = jest.fn<typeof readHostDataCacheType>();
const useSession = jest.fn<typeof useSessionType>();

jest.unstable_mockModule('../../../scripts/host/atlas-host/atlas-host', () => ({
  readDisabledOverrides,
  readHostData,
  readSuppressedArtifactIds,
}));
jest.unstable_mockModule('../../../scripts/host/host-data-cache', () => ({
  readHostDataCache,
}));
jest.unstable_mockModule('../SessionContext/SessionContext', () => ({
  useSession,
}));

const { HostProvider, useHost } = await import('./HostContext');

type HookResult = ReturnType<typeof useHost>;

export class HostContextDriver {
  private session: ExtensionSession | undefined;
  private readonly setSession = jest.fn();
  private hook: RenderHookResult<HookResult, undefined> | undefined;

  constructor() {
    jest.clearAllMocks();
    readHostDataCache.mockResolvedValue(undefined);
    readDisabledOverrides.mockResolvedValue(new Map());
    readSuppressedArtifactIds.mockResolvedValue(new Set());
  }

  readonly given = {
    session: (session: ExtensionSession | undefined): this => {
      this.session = session;

      return this;
    },
    cachedHost: (hostData: HostData, tabId: number): this => {
      readHostDataCache.mockResolvedValue({ hostData, tabId });

      return this;
    },
    cacheReadFailure: (): this => {
      readHostDataCache.mockRejectedValue(new Error('Cache unavailable.'));

      return this;
    },
    activeHost: (hostData: HostData, tabId: number): this => {
      readHostData.mockResolvedValue({ hostData, tabId });

      return this;
    },
    activeHostReadFailure: (reason: string): this => {
      readHostData.mockRejectedValue(new Error(reason));

      return this;
    },
    activeHostReadPending: (): this => {
      readHostData.mockReturnValue(new Promise(() => {}));

      return this;
    },
    disabledOverrides: (overrides: Map<string, Manifest>): this => {
      readDisabledOverrides.mockResolvedValue(overrides);

      return this;
    },
    suppressedArtifactIds: (ids: Set<string>): this => {
      readSuppressedArtifactIds.mockResolvedValue(ids);

      return this;
    },
  };

  readonly when = {
    rendered: (): this => {
      useSession.mockReturnValue({
        session: this.session,
        setSession: this.setSession,
      });
      this.hook = renderHook(() => useHost(), { wrapper: HostProvider });

      return this;
    },
    hostLoaded: async (): Promise<this> => {
      await act(() => this.get.result().loadHost());

      return this;
    },
    hostLoadStarted: async (): Promise<this> => {
      act(() => void this.get.result().loadHost());
      await waitFor(() => expect(readHostData).toHaveBeenCalled());

      return this;
    },
  };

  readonly get = {
    result: (): HookResult => {
      if (!this.hook) throw new Error('Hook was not rendered.');

      return this.hook.result.current;
    },
    status: () => this.get.result().status,
    message: (): string => this.get.result().message,
    storedSession: (): ExtensionSession | undefined =>
      this.setSession.mock.calls.at(-1)?.[0] as ExtensionSession | undefined,
    sessionStoreCount: (): number => this.setSession.mock.calls.length,
    activeHostReadCount: (): number => readHostData.mock.calls.length,
    cacheReadCount: (): number => readHostDataCache.mock.calls.length,
    disabledOverridesRequest: () => readDisabledOverrides.mock.calls[0]?.[0],
  };
}
