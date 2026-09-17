import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  assertValidGeneratorName,
  generateAppFiles,
  generateHostFiles,
  generateWidgetFiles,
  validateGeneratorOptions,
  type AngularStylesheetFormat,
  type AtlasGeneratorOptions,
} from '@atlas/generators';
import {
  CliArguments,
  pathExists,
  ui,
  type AtlasPrompter,
  type SupportedFramework,
} from '../../shared/index.js';
import type {
  AtlasProjectType,
  AtlasWorkspace,
} from '../../workspace/index.js';
import { existingFrameworkVersionInfo } from '../dependencies/dependencies.js';
import {
  ensureAtlasGeneratedFilesIgnored,
  existingPackageName,
  writeGenerated,
} from '../files/files.js';
import {
  delegatesScaffold,
  logFrameworkVersionSelection,
  logGenerationPlan,
} from '../generation-log/generation-log.js';
import { generatedOverlay } from '../overlay/overlay.js';
import {
  assertWritable,
  displayTarget,
  parseProjectPath,
  resolveContainedPath,
} from '../paths/paths.js';
import {
  alignDelegatedProject,
  alignFrameworkWorkspace,
  registerWorkspaceProject,
  resolveGenerationRoot,
  takeOverScaffold,
} from '../project-scaffold/project-scaffold.js';
import {
  ensureWorkspaceGenerator,
  resolveDevServerPort,
  resolveInnerRouting,
  resolveStylesheetFormat,
  type ProjectOptionsContext,
} from '../project-options/project-options.js';
import { resolveWidgetApp } from '../widget-apps/widget-apps.js';

interface GeneratorOptionOverrides {
  name: string;
  framework?: SupportedFramework;
  packageName?: string;
  detectedFrameworkVersion?: string;
  hostId?: string;
  routing?: boolean;
  stylesheetFormat?: AngularStylesheetFormat;
  devServerPort?: number;
}

export class AtlasGenerateService {
  constructor(
    private readonly workspace: AtlasWorkspace,
    private readonly args: CliArguments,
    private readonly prompts: AtlasPrompter,
  ) {}

  async project(
    type: AtlasProjectType,
    projectPath: string,
    framework?: SupportedFramework,
    afterGeneration?: (roots: string[]) => Promise<void>,
  ): Promise<string[]> {
    if (type === 'app' && this.args.hasFlag('host'))
      throw new Error(
        'Unknown option "--host" for app generation. Use --host-id.',
      );

    const { name, segments } = parseProjectPath(projectPath);
    const selectedFramework = framework ?? this.args.framework();
    const hostId = type === 'app' ? this.args.flag('host-id') : undefined;
    validateGeneratorOptions({
      ...this.options({ name, framework: selectedFramework, hostId }),
      ...(this.delegatesScaffold() ? { frameworkVersion: undefined } : {}),
    });

    const root = resolveGenerationRoot({
      workspace: this.workspace,
      args: this.args,
      type,
      name,
      segments,
    });
    const targetExisted = await pathExists(root);

    try {
      await this.generateProject({
        type,
        name,
        root,
        framework: selectedFramework,
        hostId,
      });

      const roots = [root];
      await afterGeneration?.(roots);
      await ensureAtlasGeneratedFilesIgnored(this.workspace.root, root);

      return roots;
    } catch (error) {
      if (!targetExisted) await rm(root, { recursive: true, force: true });

      throw error;
    }
  }

  async installDependencies(projectRoots: string[]): Promise<void> {
    if (this.workspace.kind !== 'standalone') {
      await this.workspace.installDependencies(this.workspace.root);

      return;
    }

    for (const projectRoot of projectRoots)
      await this.workspace.installDependencies(projectRoot);
  }

  async widget(name: string, requestedAppId?: string): Promise<void> {
    assertValidGeneratorName(name);

    const app = await resolveWidgetApp({
      workspace: this.workspace,
      prompts: this.prompts,
      requestedAppId,
    });
    const files = generateWidgetFiles({ name, framework: app.framework });

    for (const file of files) {
      const target = resolveContainedPath(app.project.root, file.path);
      await assertWritable(
        target,
        this.args.hasFlag('force'),
        `Widget "${name}" already exists. Use --force to replace it.`,
      );
      await mkdir(join(target, '..'), { recursive: true });
      await writeFile(target, file.contents, 'utf8');
    }

    await this.formatGenerated(app.project.root);
  }

  private async generateProject({
    type,
    name,
    root,
    framework,
    hostId,
  }: {
    type: AtlasProjectType;
    name: string;
    root: string;
    framework: SupportedFramework;
    hostId: string | undefined;
  }): Promise<void> {
    logGenerationPlan({
      workspace: this.workspace,
      args: this.args,
      framework,
      root,
    });
    await ensureWorkspaceGenerator(this.context(), framework);

    const routing = await resolveInnerRouting(this.context(), type);
    const stylesheetFormat = await resolveStylesheetFormat(
      this.context(),
      framework,
    );
    const devServerPort = await resolveDevServerPort(this.context(), type);

    if (this.delegatesScaffold() && this.prompts.interactive)
      this.prompts.close();

    const workspaceScaffolded =
      !this.args.hasFlag('skip-workspace-generator') &&
      (await this.workspace.scaffoldProject({
        type,
        name,
        framework,
        projectRoot: root,
        devServerPort,
        interactive: this.prompts.interactive,
        routing,
        stylesheetFormat,
      }));
    const packageName = workspaceScaffolded
      ? await existingPackageName(root)
      : undefined;
    const detected = workspaceScaffolded
      ? await existingFrameworkVersionInfo(root, this.workspace.root, framework)
      : undefined;
    if (detected)
      logFrameworkVersionSelection({
        workspace: this.workspace,
        args: this.args,
        framework,
        detected,
      });

    const generatorOptions = this.options({
      name,
      framework,
      packageName,
      detectedFrameworkVersion: detected?.version,
      hostId,
      routing,
      stylesheetFormat,
      devServerPort,
    });
    const files =
      type === 'host'
        ? generateHostFiles(generatorOptions)
        : generateAppFiles(generatorOptions);

    if (workspaceScaffolded) await takeOverScaffold({ root, framework });
    await writeGenerated(
      root,
      generatedOverlay(files, workspaceScaffolded, type, framework),
      workspaceScaffolded || this.args.hasFlag('force'),
    );
    await alignFrameworkWorkspace({
      root,
      name,
      type,
      framework,
      devServerPort,
    });

    if (workspaceScaffolded)
      await alignDelegatedProject({
        workspace: this.workspace,
        root,
        name,
        type,
        framework,
        devServerPort,
        frameworkVersion: generatorOptions.frameworkVersion,
        files,
      });
    await registerWorkspaceProject({
      workspace: this.workspace,
      root,
      name,
      type,
      workspaceScaffolded,
    });
    await this.formatGenerated(root);
  }

  private options(overrides: GeneratorOptionOverrides): AtlasGeneratorOptions {
    return {
      name: overrides.name,
      packageName: overrides.packageName,
      framework: overrides.framework ?? this.args.framework(),
      hostId: overrides.hostId,
      routing: overrides.routing,
      stylesheetFormat: overrides.stylesheetFormat,
      devServerPort: overrides.devServerPort,
      frameworkVersion:
        overrides.detectedFrameworkVersion ??
        this.args.flag('framework-version'),
      allowUnsupportedVersion: this.args.hasFlag('allow-unsupported-version'),
    };
  }

  private delegatesScaffold(): boolean {
    return delegatesScaffold({ workspace: this.workspace, args: this.args });
  }

  private context(): ProjectOptionsContext {
    return {
      workspace: this.workspace,
      args: this.args,
      prompts: this.prompts,
    };
  }

  private async formatGenerated(root: string): Promise<void> {
    if (this.args.hasFlag('skip-format')) return;

    if (await this.workspace.formatGenerated(root))
      ui.info(
        `Formatted generated files in ${displayTarget(this.workspace.root, root)}.`,
      );
  }
}
