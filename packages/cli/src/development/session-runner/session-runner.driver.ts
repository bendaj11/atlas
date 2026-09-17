import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import type { Server } from 'node:http';
import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import { anAppConfig } from '@atlas/testkit';
import { TemporaryDirectory } from '../../shared/fs/fs.testkit.js';
import { aProject, aWorkspace } from '../../workspace/workspace.testkit.js';
import type { startControlServer as startControlServerType } from '../control-server/control-server.js';
import type * as ProcessModule from '../process/process.js';
import { anOverrideDocument } from '../development.testkit.js';
import type { DevControlServer } from '../types.js';
import { CliArguments } from '../../shared/index.js';
import type { AtlasWorkspaceKind } from '../../workspace/index.js';

const startControlServer = jest.fn<typeof startControlServerType>();
const waitForRemoteEntry = jest.fn<typeof ProcessModule.waitForRemoteEntry>();
const waitForShutdown = jest.fn<typeof ProcessModule.waitForShutdown>();
const openBrowserWhenReady =
  jest.fn<typeof ProcessModule.openBrowserWhenReady>();
const logHostViewUrl = jest.fn<typeof ProcessModule.logHostViewUrl>();
const buildFrameworkServerArguments = jest.fn<
  typeof ProcessModule.buildFrameworkServerArguments
>((_framework, port) => ['--port', String(port)]);

jest.unstable_mockModule('../control-server/control-server.js', () => ({
  startControlServer,
}));
jest.unstable_mockModule('../process/process.js', () => ({
  waitForRemoteEntry,
  waitForShutdown,
  openBrowserWhenReady,
  logHostViewUrl,
  buildFrameworkServerArguments,
  developmentPreviewUrl: ({ hostUrl }: { hostUrl: string }) => hostUrl,
}));

const { runDevSession } = await import('./session-runner.js');

class FakeChildProcess extends EventEmitter {
  killed = false;
  readonly kill = jest.fn((_signal?: NodeJS.Signals) => {
    this.killed = true;

    return true;
  });
}

export class SessionRunnerDriver {
  private readonly directory = new TemporaryDirectory();
  private readonly child = new FakeChildProcess();
  private readonly spawn = jest.fn(() => this.child as unknown as ChildProcess);
  private readonly control: DevControlServer = {
    port: faker.internet.port(),
    markReady: jest.fn<DevControlServer['markReady']>(),
    reconcile: jest.fn<DevControlServer['reconcile']>(),
    close: jest.fn<DevControlServer['close']>(),
  };
  private readonly bootstrap = {
    listening: true,
    close: jest.fn((callback: (error?: Error) => void) => callback()),
  };
  private kind: AtlasWorkspaceKind = 'standalone';
  private flags: string[] = [];
  private beforeReady?: () => Promise<Server | undefined>;

  constructor() {
    startControlServer.mockReset().mockResolvedValue(this.control);
    waitForRemoteEntry.mockReset().mockResolvedValue(undefined);
    waitForShutdown.mockReset().mockResolvedValue(undefined);
    openBrowserWhenReady.mockReset();
    logHostViewUrl.mockReset();
  }

  readonly given = {
    project: async (): Promise<this> => {
      await this.directory.create('atlas-session-runner-');
      await this.directory.writeJson('package.json', {});

      return this;
    },
    projectScripts: async (scripts: Record<string, string>): Promise<this> => {
      await this.directory.writeJson('package.json', { scripts });

      return this;
    },
    workspaceKind: (kind: AtlasWorkspaceKind): this => {
      this.kind = kind;

      return this;
    },
    flags: (flags: string[]): this => {
      this.flags = flags;

      return this;
    },
    remoteEntryFailing: (error: Error): this => {
      waitForRemoteEntry.mockRejectedValue(error);

      return this;
    },
    bootstrapServer: (): this => {
      this.beforeReady = async () => this.bootstrap as unknown as Server;

      return this;
    },
  };

  readonly when = {
    run: (): Promise<void> =>
      runDevSession({
        workspace: aWorkspace({
          kind: this.kind,
          spawn: this.spawn,
        }),
        args: new CliArguments(['dev', 'x', ...this.flags]),
        project: aProject({ root: this.directory.root }),
        config: anAppConfig(),
        document: anOverrideDocument(),
        remoteEntryUrl: faker.internet.url(),
        frameworkPort: 4201,
        hostUrl: faker.internet.url(),
        ...(this.beforeReady ? { beforeReady: this.beforeReady } : {}),
        browserUrl: ({ controlPort }) => `http://localhost:${controlPort}/`,
      }),
  };

  readonly get = {
    spawnMock: () => this.spawn,
    killMock: () => this.child.kill,
    controlCloseMock: () => this.control.close as jest.Mock,
    controlMarkReadyMock: () => this.control.markReady as jest.Mock,
    startControlServerMock: () => startControlServer,
    openBrowserMock: () => openBrowserWhenReady,
    waitForShutdownMock: () => waitForShutdown,
    bootstrapCloseMock: () => this.bootstrap.close,
  };
}
