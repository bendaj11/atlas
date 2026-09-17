import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import type * as ChildProcessModule from 'node:child_process';
import type * as UiModule from '../../shared/ui/ui.js';
import { CliArguments } from '../../shared/arguments/arguments.js';
import {
  REMOTE_POLL_INTERVAL_MS,
  REMOTE_START_TIMEOUT_MS,
} from '../constants.js';
import type { DevControlServer } from '../types.js';

const childProcessModule = await import('node:child_process');
const spawn = jest.fn<typeof ChildProcessModule.spawn>();
jest.unstable_mockModule('node:child_process', () => ({
  ...childProcessModule,
  spawn,
}));

const uiModule = await import('../../shared/ui/ui.js');
const linkedResult = jest.fn<typeof UiModule.ui.linkedResult>();
const warning = jest.fn<typeof UiModule.ui.warning>();
jest.unstable_mockModule('../../shared/ui/ui.js', () => ({
  ...uiModule,
  ui: { ...uiModule.ui, linkedResult, warning },
}));

const {
  buildBrowserOpenCommand,
  buildFrameworkServerArguments,
  developmentPreviewUrl,
  formatFrameworkServerError,
  isRemoteEntryReady,
  logHostViewUrl,
  openBrowserWhenReady,
  waitForRemoteEntry,
  waitForShutdown,
} = await import('./process.js');

class FakeChildProcess extends EventEmitter {
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;
  killed = false;
  readonly kill = jest.fn((_signal?: NodeJS.Signals) => {
    this.killed = true;

    return true;
  });
  readonly unref = jest.fn();
}

export class DevelopmentProcessDriver {
  private readonly child = new FakeChildProcess();
  private readonly fetch = jest.fn<typeof globalThis.fetch>();
  private readonly originalFetch = globalThis.fetch;
  private readonly control: DevControlServer = {
    port: faker.internet.port(),
    markReady: jest.fn<DevControlServer['markReady']>(),
    reconcile: jest.fn<DevControlServer['reconcile']>(),
    close: jest.fn<DevControlServer['close']>(),
  };
  private readonly remoteEntryUrl = faker.internet.url();
  private flags: string[] = [];
  private shutdown?: Promise<void>;

  constructor() {
    spawn.mockReset();
    linkedResult.mockReset();
    warning.mockReset();
    spawn.mockReturnValue(this.child as unknown as ChildProcess);
    Object.assign(globalThis, { fetch: this.fetch });
  }

  readonly given = {
    childExitCode: (code: number | null) => {
      this.child.exitCode = code;

      return this;
    },
    remoteEntryResponse: (response: Response) => {
      this.fetch.mockResolvedValue(response);

      return this;
    },
    remoteEntryUnreachable: () => {
      this.fetch.mockRejectedValue(new Error('ECONNREFUSED'));

      return this;
    },
    controlCloseFailure: (error: Error) => {
      this.control.close = jest
        .fn<DevControlServer['close']>()
        .mockRejectedValue(error);

      return this;
    },
    flags: (flags: string[]) => {
      this.flags = flags;

      return this;
    },
    spawnFailure: (error: Error) => {
      spawn.mockImplementation(() => {
        throw error;
      });

      return this;
    },
  };

  readonly when = {
    remoteEntryAwaited: async () => {
      try {
        await waitForRemoteEntry(
          this.remoteEntryUrl,
          this.child as unknown as ChildProcess,
        );
      } finally {
        globalThis.fetch = this.originalFetch;
      }
    },
    remoteEntryAwaitedUntilTimeout: async () => {
      jest.useFakeTimers();

      try {
        const waiting = waitForRemoteEntry(
          this.remoteEntryUrl,
          this.child as unknown as ChildProcess,
        );
        const settled = waiting.then(
          () => undefined,
          (error: unknown) => error,
        );
        await jest.advanceTimersByTimeAsync(
          REMOTE_START_TIMEOUT_MS + REMOTE_POLL_INTERVAL_MS,
        );
        const error = await settled;

        if (error) throw error;
      } finally {
        jest.useRealTimers();
        globalThis.fetch = this.originalFetch;
      }
    },
    shutdownAwaited: () => {
      this.shutdown = waitForShutdown(
        this.child as unknown as ChildProcess,
        this.control,
      );
    },
    childExited: async (code: number | null, signal: NodeJS.Signals | null) => {
      this.child.emit('exit', code, signal);
      await this.shutdown;
    },
    childFailed: async (error: Error) => {
      this.child.emit('error', error);
      await this.shutdown;
    },
    interrupted: async () => {
      process.emit('SIGINT');
      this.child.emit('exit', null, 'SIGTERM');
      await this.shutdown;
    },
    hostViewLogged: (url: string | undefined, browserUrl?: string) => {
      logHostViewUrl(url, browserUrl);
    },
    browserOpened: (url: string | undefined) => {
      openBrowserWhenReady(new CliArguments(this.flags), url);
    },
    browserOpenFailed: () => {
      openBrowserWhenReady(new CliArguments(this.flags), faker.internet.url());
      this.child.emit('error', new Error('ENOENT'));
    },
  };

  readonly get = {
    remoteEntryReadiness: (response: Response) => isRemoteEntryReady(response),
    browserOpenCommand: (url: string, platform: NodeJS.Platform) =>
      buildBrowserOpenCommand(url, platform),
    frameworkServerArguments: (framework: 'angular' | 'react', port: number) =>
      buildFrameworkServerArguments(framework, port),
    frameworkServerError: (message: string, output: string) =>
      formatFrameworkServerError(message, output).message,
    previewUrl: (hostUrl: string, controlPort: number) =>
      developmentPreviewUrl({ hostUrl, controlPort }),
    remoteEntryUrl: () => this.remoteEntryUrl,
    fetchMock: () => this.fetch,
    killMock: () => this.child.kill,
    controlCloseMock: () => this.control.close,
    spawnMock: () => spawn,
    unrefMock: () => this.child.unref,
    linkedResultMock: () => linkedResult,
    warningMock: () => warning,
  };
}
