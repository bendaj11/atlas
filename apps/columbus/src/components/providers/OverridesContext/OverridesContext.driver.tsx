import { jest } from '@jest/globals';
import { act, renderHook, type RenderHookResult } from '@testing-library/react';
import type {
  ArtifactSelection,
  ExtensionSession,
  Scope,
} from '../../../types/app';
import { aSession } from '../../../types/app.testkit';
import { errorMessage } from '../../../scripts/host/atlas-host/atlas-host';
import type * as OverrideSessionModule from '../../../scripts/overrides/override-session/override-session';
import type { persistOverrideSession as persistOverrideSessionType } from '../../../scripts/overrides/persist-overrides';
import type { useSession as useSessionType } from '../SessionContext/SessionContext';

type OverrideSession = typeof OverrideSessionModule;

const toggleOverrideInSession =
  jest.fn<OverrideSession['toggleOverrideInSession']>();
const saveOverrideInSession =
  jest.fn<OverrideSession['saveOverrideInSession']>();
const clearAllOverridesInSession =
  jest.fn<OverrideSession['clearAllOverridesInSession']>();
const clearOverrideInSession =
  jest.fn<OverrideSession['clearOverrideInSession']>();
const setOverrideScopeInSession =
  jest.fn<OverrideSession['setOverrideScopeInSession']>();
const persistOverrideSession = jest.fn<typeof persistOverrideSessionType>();
const useSession = jest.fn<typeof useSessionType>();

jest.unstable_mockModule('../../../scripts/host/atlas-host/atlas-host', () => ({
  errorMessage,
}));
jest.unstable_mockModule(
  '../../../scripts/overrides/override-session/override-session',
  () => ({
    clearAllOverridesInSession,
    clearOverrideInSession,
    saveOverrideInSession,
    setOverrideScopeInSession,
    toggleOverrideInSession,
  }),
);
jest.unstable_mockModule(
  '../../../scripts/overrides/persist-overrides',
  () => ({
    persistOverrideSession,
  }),
);
jest.unstable_mockModule('../SessionContext/SessionContext', () => ({
  useSession,
}));

const { OverridesProvider, useOverrides } = await import('./OverridesContext');

type HookResult = ReturnType<typeof useOverrides>;

export class OverridesContextDriver {
  private session: ExtensionSession | undefined = aSession();
  private readonly nextSession = aSession();
  private readonly setSession = jest.fn();
  private readonly closeWindow = jest.spyOn(window, 'close');
  private hook: RenderHookResult<HookResult, undefined> | undefined;

  constructor() {
    jest.clearAllMocks();
    this.closeWindow.mockImplementation(() => {});
    toggleOverrideInSession.mockReturnValue(this.nextSession);
    saveOverrideInSession.mockReturnValue(this.nextSession);
    clearAllOverridesInSession.mockReturnValue(this.nextSession);
    clearOverrideInSession.mockReturnValue(this.nextSession);
    setOverrideScopeInSession.mockReturnValue(this.nextSession);
    persistOverrideSession.mockResolvedValue(undefined);
  }

  readonly given = {
    session: (session: ExtensionSession | undefined): this => {
      this.session = session;

      return this;
    },
    toggleResult: (session: ExtensionSession | undefined): this => {
      toggleOverrideInSession.mockReturnValue(session);

      return this;
    },
    persistFailure: (reason: string): this => {
      persistOverrideSession.mockRejectedValue(new Error(reason));

      return this;
    },
    persistPending: (): this => {
      persistOverrideSession.mockReturnValue(new Promise(() => {}));

      return this;
    },
  };

  readonly when = {
    rendered: (): this => {
      useSession.mockReturnValue({
        session: this.session,
        setSession: this.setSession,
      });
      this.hook = renderHook(() => useOverrides(), {
        wrapper: OverridesProvider,
      });

      return this;
    },
    overrideToggled: async (artifactKey: string): Promise<this> => {
      await act(() => this.get.result().toggleOverride(artifactKey));

      return this;
    },
    overrideToggleStarted: (artifactKey: string): this => {
      act(() => void this.get.result().toggleOverride(artifactKey));

      return this;
    },
    overrideSaved: async (selection: ArtifactSelection): Promise<this> => {
      await act(async () => this.get.result().saveOverride(selection));

      return this;
    },
    overrideCleared: async (artifactKey: string): Promise<this> => {
      await act(() => this.get.result().clearOverride(artifactKey));

      return this;
    },
    allOverridesCleared: async (): Promise<this> => {
      await act(() => this.get.result().clearAllOverrides());

      return this;
    },
    scopeSet: (scope: Scope): this => {
      act(() => this.get.result().setScope(scope));

      return this;
    },
    errorReported: (message: string): this => {
      act(() => this.get.result().reportError(message));

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
    hasOverrides: (): boolean => this.get.result().hasOverrides,
    scope: (): Scope => this.get.result().scope,
    nextSession: (): ExtensionSession => this.nextSession,
    storedSession: (): unknown => this.setSession.mock.calls.at(-1)?.[0],
    storedSessionUpdate: (current: ExtensionSession | undefined): unknown => {
      const update = this.setSession.mock.calls.at(-1)?.[0] as (
        current: ExtensionSession | undefined,
      ) => unknown;

      return update(current);
    },
    persistedSession: (): unknown => persistOverrideSession.mock.calls[0]?.[0],
    persistCount: (): number => persistOverrideSession.mock.calls.length,
    toggleRequest: () => toggleOverrideInSession.mock.calls[0]?.[0],
    saveRequest: () => saveOverrideInSession.mock.calls[0]?.[0],
    clearRequest: () => clearOverrideInSession.mock.calls[0]?.[0],
    clearAllRequest: () => clearAllOverridesInSession.mock.calls[0]?.[0],
    scopeRequest: () => setOverrideScopeInSession.mock.calls[0]?.[0],
    windowCloseCount: (): number => this.closeWindow.mock.calls.length,
  };
}
