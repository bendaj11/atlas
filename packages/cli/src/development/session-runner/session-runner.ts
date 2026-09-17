import type { ChildProcess } from 'node:child_process';
import type { Server } from 'node:http';
import type { AtlasConfig } from '@atlas/schema';
import { startControlServer } from '../control-server/control-server.js';
import { closeServer, localOrigin } from '../http/http.js';
import { DEFAULT_CONTROL_PORT } from '../constants.js';
import {
  frameworkServerArguments,
  logHostViewUrl,
  openBrowserWhenReady,
  waitForRemoteEntry,
  waitForShutdown,
} from '../process/process.js';
import type { AtlasDevOverrideDocument, DevControlServer } from '../types.js';
import { type CliArguments, readJsonFile } from '../../shared/index.js';
import type { AtlasProject, AtlasWorkspace } from '../../workspace/index.js';
import { resolveRegistryUrl } from '../../build/index.js';

export interface DevSessionContext {
  controlPort: number;
  controlOrigin: string;
  registryUrl: string | undefined;
  frameworkServer: ChildProcess;
  control: DevControlServer;
}

export interface DevSessionOptions {
  workspace: AtlasWorkspace;
  args: CliArguments;
  project: AtlasProject;
  config: AtlasConfig;
  document: AtlasDevOverrideDocument;
  remoteEntryUrl: string;
  frameworkPort: number;
  hostUrl: string;
  beforeReady?: (context: DevSessionContext) => Promise<Server | undefined>;
  browserUrl: (context: DevSessionContext) => string;
}

export async function runDevSession(options: DevSessionOptions): Promise<void> {
  const { workspace, args, project, config, document } = options;
  const controlPort = args.port('control-port', DEFAULT_CONTROL_PORT);
  const controlOrigin = localOrigin(controlPort);
  const registryUrl = resolveRegistryUrl(args);
  const devTask = await frameworkDevTask(workspace, project);
  const control = await startControlServer({
    port: controlPort,
    document,
    overrideUrl: `${controlOrigin}/atlas.local-overrides.json`,
    ...(registryUrl ? { registryUrl } : {}),
    environment: args.flag('environment') ?? 'production',
  });
  const frameworkServer = workspace.spawn(
    project,
    devTask,
    frameworkServerArguments(config.framework, options.frameworkPort),
  );
  const context: DevSessionContext = {
    controlPort,
    controlOrigin,
    registryUrl,
    frameworkServer,
    control,
  };
  let bootstrap: Server | undefined;

  try {
    await waitForRemoteEntry(options.remoteEntryUrl, frameworkServer);
    bootstrap = await options.beforeReady?.(context);
    await control.markReady();
    const browserUrl = options.browserUrl(context);
    logHostViewUrl(options.hostUrl, browserUrl);
    openBrowserWhenReady(args, browserUrl);
    await waitForShutdown(frameworkServer, control);
  } catch (error) {
    if (!frameworkServer.killed) frameworkServer.kill('SIGTERM');
    await control.close();

    throw error;
  } finally {
    if (bootstrap) await closeServer(bootstrap);
  }
}

async function frameworkDevTask(
  workspace: AtlasWorkspace,
  project: AtlasProject,
): Promise<'dev' | 'framework:dev' | 'serve'> {
  if (workspace.kind === 'nx') return 'serve';
  const packageJson = await readJsonFile<{ scripts?: Record<string, string> }>(
    `${project.root}/package.json`,
  );

  return packageJson?.scripts?.['framework:dev'] ? 'framework:dev' : 'dev';
}
