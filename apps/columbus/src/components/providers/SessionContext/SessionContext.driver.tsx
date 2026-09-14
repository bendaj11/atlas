import { jest } from '@jest/globals';
import { act, renderHook, type RenderHookResult } from '@testing-library/react';
import type { ExtensionSession } from '../../../types/app';
import { SessionProvider, useSession } from './SessionContext';

type HookResult = ReturnType<typeof useSession>;

export class SessionContextDriver {
  private hook: RenderHookResult<HookResult, undefined> | undefined;
  private renderError: unknown;

  readonly when = {
    rendered: (): this => {
      this.hook = renderHook(() => useSession(), { wrapper: SessionProvider });

      return this;
    },
    renderedWithoutProvider: (): this => {
      const consoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      try {
        renderHook(() => useSession());
      } catch (error) {
        this.renderError = error;
      } finally {
        consoleError.mockRestore();
      }

      return this;
    },
    sessionSet: (session: ExtensionSession | undefined): this => {
      act(() => this.get.result().setSession(session));

      return this;
    },
  };

  readonly get = {
    result: (): HookResult => {
      if (!this.hook) throw new Error('Hook was not rendered.');

      return this.hook.result.current;
    },
    session: (): ExtensionSession | undefined => this.get.result().session,
    renderError: (): unknown => this.renderError,
  };
}
