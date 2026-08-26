import type { Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import type { AtlasRuntimeOverrideDocument } from '@atlas/runtime';
import type { AtlasHostConfig } from '@atlas/schema';
import { CliArguments } from '../../cli/arguments.js';
import { loadBootstrapTemplate } from '../../bootstrap/template/bootstrap-template.js';
import { compileAtlasConfig } from '../../build/config-compiler/config-compiler.js';
import { resolveRegistryUrl } from '../../build/runtime-config/runtime-config.js';
import { ensureAngularBuildNotifications } from '../../generation/angular.js';
import { startLocalBootstrapServer } from '../bootstrap-server/bootstrap-server.js';
import { startControlServer } from '../control-server/control-server.js';
import {
  isHostConfig,
  readAngularProxyConfigPath,
  readConfiguredDevServerPort,
} from '../config/config.js';
import { closeServer, localOrigin } from '../http/http.js';
import {
  DEFAULT_APP_DEV_PORT,
  DEFAULT_CONTROL_PORT,
  DEFAULT_HOST_BOOTSTRAP_PORT,
} from '../constants.js';
import {
  frameworkServerArguments,
  logHostViewUrl,
  openBrowserWhenReady,
  waitForRemoteEntry,
  waitForShutdown,
  withDevSessionPort,
} from '../process/process.js';
import { readAtlasPreviewUrls } from '../target/previews.js';
import { resolveDevTarget } from '../target/target.js';
import { assertUsableAngularBuildPackage } from '../preflight/preflight.js';
import { writeDevOverrideDocument } from '../overrides.js';
import { loadAngularHostProxy } from '../proxy-config.js';
import { nonInteractivePrompter } from '../prompts.js';
import { resolveHostDevPorts } from '../ports/ports.js';
import type {
  AppDevelopmentOptions,
  AtlasDevBuildService,
  AtlasDevOverrideDocument,
  DevPrompts,
} from '../types.js';
import { loadEnvFiles } from '../../workspace/env/env.js';
import { ui } from '../../cli/ui/ui.js';
import type {
  AtlasProject,
  AtlasWorkspace,
} from '../../workspace/service/workspace.js';

export class AtlasDevService {
  constructor(
    private readonly workspace: AtlasWorkspace,
    private readonly args: CliArguments,
    private readonly builds: AtlasDevBuildService,
  ) {}

  async run(
    name: string,
    prompts: DevPrompts = nonInteractivePrompter,
  ): Promise<void> {
    const project = await this.workspace.findProject(name);
    await loadEnvFiles(project.root);
    if (project.root !== this.workspace.root)
      await loadEnvFiles(this.workspace.root);
    await compileAtlasConfig(this.workspace, project);
    const config = await this.builds.loadConfig(project.root);
    if (config.framework === 'angular' && !this.args.hasFlag('prepare-only')) {
      await assertUsableAngularBuildPackage(this.workspace.root, project.root);
      await ensureAngularBuildNotifications(project.root, project.id);
    }
    if (isHostConfig(config)) {
      await this.runHost(project, config);
      return;
    }
    await this.runApp({ project, name, config, prompts });
  }

  private async runHost(
    project: AtlasProject,
    config: AtlasHostConfig,
  ): Promise<void> {
    const configuredPort = await this.resolveRemotePort(
      project,
      DEFAULT_HOST_BOOTSTRAP_PORT,
    );
    const { bootstrapPort, clientPort } = resolveHostDevPorts(
      this.args,
      configuredPort,
    );
    if (!this.builds.buildLocalHostManifest) {
      throw new Error(
        'Atlas host development requires host-client build support.',
      );
    }
    const manifest = await this.builds.buildLocalHostManifest(
      project.id,
      localOrigin(clientPort),
    );
    const document: AtlasDevOverrideDocument = {
      schemaVersion: '1',
      hostId: config.id,
      hostOverride: manifest,
      overrides: [],
      generatedAt: new Date().toISOString(),
    };
    await writeDevOverrideDocument(project.root, document);

    const configuredHostUrl = this.args.flag('host-url');
    const hostUrl = configuredHostUrl ?? localOrigin(bootstrapPort);
    if (this.args.hasFlag('prepare-only')) {
      ui.success(`Prepared host client "${config.id}" for ${hostUrl}.`);
      ui.info('Run without --prepare-only to start development servers.');
      return;
    }

    const controlPort = this.args.port('control-port', DEFAULT_CONTROL_PORT);
    const controlOrigin = localOrigin(controlPort);
    const registryUrl = resolveRegistryUrl(this.args);
    const control = await startControlServer({
      port: controlPort,
      document,
      overrideUrl: `${controlOrigin}/atlas.local-overrides.json`,
      ...(registryUrl ? { registryUrl } : {}),
      environment: this.args.flag('environment') ?? 'production',
    });
    const frameworkServer = this.workspace.spawn(
      project,
      await this.frameworkDevTask(project),
      frameworkServerArguments(config.framework, clientPort),
    );
    const usesLocalBootstrap = configuredHostUrl === undefined;
    const template = usesLocalBootstrap
      ? await loadBootstrapTemplate(project.root)
      : undefined;
    let bootstrap: Server | undefined;
    try {
      await waitForRemoteEntry(manifest.remoteEntryUrl, frameworkServer);
      const proxy =
        config.framework === 'angular'
          ? await loadAngularHostProxy(
              project.root,
              await readAngularProxyConfigPath(project.root, project.id),
              localOrigin(clientPort),
            )
          : undefined;
      bootstrap = usesLocalBootstrap
        ? await startLocalBootstrapServer({
            port: bootstrapPort,
            ...(template !== undefined ? { html: template } : {}),
            ...(proxy !== undefined ? { proxy } : {}),
            runtime: {
              schemaVersion: '1',
              hostId: config.id,
              manifestUrl: `${controlOrigin}/environments/development/hosts/${config.id}/manifest.json`,
              developmentSessionUrl: `${controlOrigin}/atlas.dev-session.json?hostId=${encodeURIComponent(config.id)}`,
              environment: 'development',
              ...(registryUrl ? { registryUrl } : {}),
              resourcesTimeoutMs: config.resourcesTimeoutMs ?? 15_000,
              resourcesRetryCount: config.resourcesRetryCount ?? 3,
              assetOrigins: [localOrigin(clientPort), controlOrigin],
            },
          })
        : undefined;
      await control.markReady();
      const hostActivationUrl = withDevSessionPort(hostUrl, controlPort);
      logHostViewUrl(hostUrl, hostActivationUrl);
      openBrowserWhenReady(this.args, hostActivationUrl);
      await waitForShutdown(frameworkServer, control);
    } finally {
      if (bootstrap) await closeServer(bootstrap);
    }
  }

  private async runApp({
    project,
    name,
    config,
    prompts,
  }: AppDevelopmentOptions): Promise<void> {
    const remotePort = await this.resolveRemotePort(project);
    const controlPort = this.args.port('control-port', DEFAULT_CONTROL_PORT);
    const manifest = await this.builds.buildManifest(name, 'local', {
      skipCompile: true,
      baseUrl: localOrigin(remotePort),
    });
    const target = await resolveDevTarget({
      config,
      prompts,
      previewUrls: await readAtlasPreviewUrls(project.root),
    });
    const document: AtlasRuntimeOverrideDocument = {
      schemaVersion: '1',
      hostId: target.hostId,
      overrides: [{ appId: manifest.id, manifest, reason: 'local' }],
      generatedAt: new Date().toISOString(),
    };
    await writeDevOverrideDocument(project.root, document);

    const overrideUrl = `${localOrigin(controlPort)}/atlas.local-overrides.json`;
    if (this.args.hasFlag('prepare-only')) {
      logHostViewUrl(target.hostUrl);
      return;
    }
    const hostActivationUrl = withDevSessionPort(target.hostUrl, controlPort);
    const registryUrl = resolveRegistryUrl(this.args);
    const control = await startControlServer({
      port: controlPort,
      document,
      overrideUrl,
      ...(registryUrl ? { registryUrl } : {}),
      environment: this.args.flag('environment') ?? 'production',
    });
    const frameworkServer = this.workspace.spawn(
      project,
      await this.frameworkDevTask(project),
      frameworkServerArguments(config.framework, remotePort),
    );
    try {
      await waitForRemoteEntry(manifest.remoteEntryUrl, frameworkServer);
      await control.markReady();
      logHostViewUrl(target.hostUrl, hostActivationUrl);
      openBrowserWhenReady(this.args, hostActivationUrl);
    } catch (error) {
      if (!frameworkServer.killed) frameworkServer.kill('SIGTERM');
      await control.close();
      throw error;
    }
    await waitForShutdown(frameworkServer, control);
  }

  private async frameworkDevTask(
    project: AtlasProject,
  ): Promise<'dev' | 'framework:dev' | 'serve'> {
    if (this.workspace.kind === 'nx') return 'serve';
    const packageJson = JSON.parse(
      await readFile(`${project.root}/package.json`, 'utf8'),
    ) as { scripts?: Record<string, string> };
    return packageJson.scripts?.['framework:dev'] ? 'framework:dev' : 'dev';
  }

  private async resolveRemotePort(
    project: AtlasProject,
    fallback = DEFAULT_APP_DEV_PORT,
  ): Promise<number> {
    if (this.args.hasFlag('port')) return this.args.port('port', fallback);
    return (
      (await readConfiguredDevServerPort(project.root, project.id)) ?? fallback
    );
  }
}
