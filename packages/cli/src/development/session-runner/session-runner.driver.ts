import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import type { Server } from 'node:http';
import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import { anAppConfig, anOverrideDocument } from '@atlas/testkit/internal';
import type { startControlServer as startControlServerType } from '../control-server/control-server.js';
import type * as ProcessModule from '../process/process.js';
import type { DevControlServer } from '../types.js';
import type { AtlasWorkspaceKind } from '../../workspace/index.js';
import { TemporaryDirectory } from '../../shared/fs/fs.testkit.js';

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

const { aProject, aWorkspace } =
  await import('../../workspace/workspace.testkit.js');
const { CliArguments } = await import('../../shared/index.js');

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
    project: async () => {
      await this.directory.create('atlas-session-runner-');
      await this.directory.writeJson('package.json', {});

      return this;
    },
    projectScripts: async (scripts: Record<string, string>) => {
      await this.directory.writeJson('package.json', { scripts });

      return this;
    },
    workspaceKind: (kind: AtlasWorkspaceKind) => {
      this.kind = kind;

      return this;
    },
    flags: (flags: string[]) => {
      this.flags = flags;

      return this;
    },
    remoteEntryFailing: (error: Error) => {
      waitForRemoteEntry.mockRejectedValue(error);

      return this;
    },
    bootstrapServer: () => {
      this.beforeReady = async () => this.bootstrap as unknown as Server;

      return this;
    },
  };

  readonly when = {
    run: () =>
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
