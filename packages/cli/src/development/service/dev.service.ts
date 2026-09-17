import type { AtlasHostConfig } from '@atlas/schema';
import { startLocalBootstrapServer } from '../bootstrap-server/bootstrap-server.js';
import {
  readAngularProxyConfigPath,
  readConfiguredDevServerPort,
} from '../config/config.js';
import {
  DEFAULT_APP_DEV_PORT,
  DEFAULT_HOST_BOOTSTRAP_PORT,
} from '../constants.js';
import { buildLocalOrigin } from '../http/http.js';
import { writeDevOverrideDocument } from '../overrides/overrides.js';
import { resolveHostDevPorts } from '../ports/ports.js';
import { assertUsableAngularBuildPackage } from '../preflight/preflight.js';
import { developmentPreviewUrl, logHostViewUrl } from '../process/process.js';
import { nonInteractivePrompter } from '../prompts/prompts.js';
import { loadAngularHostProxy } from '../proxy-config/proxy-config.js';
import { runDevSession } from '../session-runner/session-runner.js';
import { readAtlasPreviewUrls } from '../target/previews.js';
import { resolveDevTarget, resolveHostDevTarget } from '../target/target.js';
import type {
  AppDevelopmentOptions,
  AtlasDevBuildService,
  AtlasDevOverrideDocument,
  DevPrompts,
  HostDevTarget,
} from '../types.js';
import {
  CliArguments,
  ui,
  compileAtlasConfig,
  isHostConfig,
} from '../../shared/index.js';
import { loadBootstrapTemplate } from '../../bootstrap/index.js';
import { ensureAngularBuildNotifications } from '../../generation/index.js';
import {
  loadEnvFiles,
  type AtlasProject,
  type AtlasWorkspace,
} from '../../workspace/index.js';

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

    if (this.args.hasFlag('host-url')) {
      throw new Error(
        '--host-url is not supported by atlas dev. Define package.json atlas.previews instead.',
      );
    }

    if (config.framework === 'angular' && !this.args.hasFlag('prepare-only')) {
      await assertUsableAngularBuildPackage(this.workspace.root, project.root);
      await ensureAngularBuildNotifications({
        root: project.root,
        projectName: project.id,
      });
    }

    if (isHostConfig(config)) {
      await this.runHost(project, config, prompts);

      return;
    }

    await this.runApp({ project, name, config, prompts });
  }

  private async runHost(
    project: AtlasProject,
    config: AtlasHostConfig,
    prompts: DevPrompts,
  ): Promise<void> {
    const configuredPort = await this.resolveRemotePort(
      project,
      DEFAULT_HOST_BOOTSTRAP_PORT,
    );
    const configuredBootstrapPort = this.args.port(
      'bootstrap-port',
      configuredPort,
    );
    const target = await resolveHostDevTarget({
      config,
      localPreviewUrl: buildLocalOrigin(configuredBootstrapPort),
      prompts,
      previewUrls: await readAtlasPreviewUrls(project.root),
    });
    const { bootstrapPort, clientPort } = resolveHostDevPorts({
      args: this.args,
      configuredPort,
      previewKind: target.previewKind,
    });
    assertLocalPreviewPort(target, bootstrapPort);

    const manifest = await this.builds.buildLocalHostManifest(
      project.id,
      buildLocalOrigin(clientPort),
    );
    const hostUrl = target.hostUrl;
    const document: AtlasDevOverrideDocument = {
      schemaVersion: '1',
      hostId: config.id,
      hostOverride: manifest,
      overrides: [],
      generatedAt: new Date().toISOString(),
      previewUrl: hostUrl,
    };
    await writeDevOverrideDocument(project.root, document);

    if (this.args.hasFlag('prepare-only')) {
      ui.success(`Prepared host client "${config.id}" for ${hostUrl}.`);
      ui.info('Run without --prepare-only to start development servers.');

      return;
    }
    const usesLocalBootstrap = target.previewKind === 'local';
    const template = usesLocalBootstrap
      ? await loadBootstrapTemplate(project.root)
      : undefined;
    await runDevSession({
      workspace: this.workspace,
      args: this.args,
      project,
      config,
      document,
      remoteEntryUrl: manifest.remoteEntryUrl,
      frameworkPort: clientPort,
      hostUrl,
      beforeReady: async ({ controlOrigin, registryUrl }) => {
        if (!usesLocalBootstrap) return undefined;
        const proxy =
          config.framework === 'angular'
            ? await loadAngularHostProxy(
                project.root,
                await readAngularProxyConfigPath(project.root, project.id),
                buildLocalOrigin(clientPort),
              )
            : undefined;

        return startLocalBootstrapServer({
          port: bootstrapPort,
          ...(template !== undefined ? { html: template } : {}),
          ...(proxy !== undefined ? { proxy } : {}),
          runtime: {
            schemaVersion: 'v1',
            hostId: config.id,
            artifactRegistryUrl: registryUrl ?? controlOrigin,
            environmentRegistryUrl: controlOrigin,
            developmentSessionUrl: `${controlOrigin}/atlas.dev-session.json?hostId=${encodeURIComponent(config.id)}`,
            environment: 'development',
            resourcesTimeoutMs: config.resourcesTimeoutMs ?? 15_000,
            resourcesRetryCount: config.resourcesRetryCount ?? 3,
          },
        });
      },
      browserUrl: ({ controlPort }) =>
        usesLocalBootstrap
          ? hostUrl
          : developmentPreviewUrl({ hostUrl, controlPort }),
    });
  }

  private async runApp({
    project,
    name,
    config,
    prompts,
  }: AppDevelopmentOptions): Promise<void> {
    const remotePort = await this.resolveRemotePort(project);
    const manifest = await this.builds.buildManifest(name, 'local', {
      skipCompile: true,
      baseUrl: buildLocalOrigin(remotePort),
    });
    const target = await resolveDevTarget({
      config,
      prompts,
      previewUrls: await readAtlasPreviewUrls(project.root),
    });
    const document: AtlasDevOverrideDocument = {
      schemaVersion: '1',
      hostId: target.hostId,
      overrides: [{ appId: manifest.id, manifest, reason: 'local' }],
      generatedAt: new Date().toISOString(),
      previewUrl: target.hostUrl,
    };
    await writeDevOverrideDocument(project.root, document);

    if (this.args.hasFlag('prepare-only')) {
      logHostViewUrl(target.hostUrl);

      return;
    }

    await runDevSession({
      workspace: this.workspace,
      args: this.args,
      project,
      config,
      document,
      remoteEntryUrl: manifest.remoteEntryUrl,
      frameworkPort: remotePort,
      hostUrl: target.hostUrl,
      browserUrl: ({ controlPort }) =>
        developmentPreviewUrl({ hostUrl: target.hostUrl, controlPort }),
    });
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

function assertLocalPreviewPort(
  target: HostDevTarget,
  bootstrapPort: number,
): void {
  if (target.previewKind !== 'local') return;
  const preview = new URL(target.hostUrl);
  const previewPort = Number(
    preview.port || (preview.protocol === 'https:' ? 443 : 80),
  );

  if (preview.protocol === 'http:' && previewPort === bootstrapPort) return;
  throw new Error(
    `Local host preview "${target.hostUrl}" must use http and configured bootstrap port ${bootstrapPort}. Update atlas.previews or pass --port=${previewPort}.`,
  );
}
