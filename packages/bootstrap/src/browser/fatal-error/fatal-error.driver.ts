import { showFatalError } from './fatal-error.js';
import { jest } from '@jest/globals';

export class FatalErrorDriver {
  private error: Error | undefined;
  private root: { append: jest.Mock; replaceChildren: jest.Mock } | undefined;
  private createElement = jest.fn();
  private resetButton: { onclick: (() => void) | null } | undefined;

  readonly given = {
    error: (error: Error): FatalErrorDriver => {
      this.error = error;
      this.resetButton = undefined;
      Object.assign(console, { error: jest.fn() });
      this.root = { append: jest.fn(), replaceChildren: jest.fn() };
      this.createElement.mockImplementation((...args: unknown[]) => {
        const [tagName] = args;
        const element = {
          onclick: null as (() => void) | null,
          textContent: '',
          append: jest.fn(),
          setAttribute: jest.fn(),
        };

        if (tagName === 'button') this.resetButton = element;

        return element;
      });
      Object.assign(globalThis, {
        document: {
          body: this.root,
          createElement: this.createElement,
          getElementById: () => this.root,
        },
        localStorage: { removeItem: jest.fn() },
        sessionStorage: { removeItem: jest.fn() },
        location: { reload: jest.fn() },
      });
      return this;
    },
  };

  readonly when = {
    clearOverrides: (): void => {
      this.resetButton?.onclick?.();
    },
    show: (): void => showFatalError(this.error),
  };

  readonly get = {
    rendered: (): boolean => this.root?.append.mock.calls.length === 1,
    reloadCount: (): number =>
      (location.reload as unknown as jest.Mock).mock.calls.length,
  };
}
