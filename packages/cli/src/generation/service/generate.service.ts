import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  assertValidGeneratorName,
  generateAppFiles,
  generateHostFiles,
  generateWidgetFiles,
  validateGeneratorOptions,
  type AngularStylesheetFormat,
  type AtlasGeneratedFile,
  type AtlasGeneratorOptions,
} from '@atlas/generators';
import { CliArguments, type SupportedFramework } from '../../cli/arguments.js';
import { ui, type AtlasPrompter } from '../../cli/ui/ui.js';
import { exists } from '../../shared/fs/fs.js';
import type { AtlasWorkspace } from '../../workspace/types.js';
import { ensureAngularWorkspaceFederationConfig } from '../angular.js';
import {
  dependencyManifestPath,
  existingFrameworkVersionInfo,
  mergePackageDependencies,
  type FrameworkVersionInfo,
} from '../dependencies.js';
import {
  ensureAtlasGeneratedFilesIgnored,
  existingPackageName,
  removeDelegatedReactViteConfigs,
  takeOverAppSource,
  writeGenerated,
} from '../files/files.js';
import { frameworkLabel } from '../labels.js';
import {
  alignDelegatedAngularFederationConfig,
  alignDelegatedTsconfig,
  ensureDelegatedNxTargets,
} from '../nx/nx.js';
import { generatedOverlay } from '../overlay.js';
import {
  assertWritable,
  displayTarget,
  parseProjectPath,
  resolveContainedPath,
  workspaceLabel,
} from '../paths/paths.js';
import {
  ensureWorkspaceGenerator,
  resolveDevServerPort,
  resolveInnerRouting,
  resolveStylesheetFormat,
  type ProjectOptionsContext,
} from '../project-options/project-options.js';
import { resolveWidgetApp } from '../widget-apps/widget-apps.js';
import {
  ensureTurboTasks,
  writeNxProject,
} from '../workspace-targets/workspace-targets.js';

export class AtlasGenerateService {
  constructor(
    private readonly workspace: AtlasWorkspace,
    private readonly args: CliArguments,
    private readonly prompts: AtlasPrompter,
  ) {}

  async project(
    type: 'host' | 'app',
    projectPath: string,
    framework?: SupportedFramework,
    afterGeneration?: (roots: string[]) => Promise<void>,
  ): Promise<string[]> {
    if (type === 'app' && this.args.hasFlag('host')) {
      throw new Error(
        'Unknown option "--host" for app generation. Use --host-id.',
      );
    }
    const { name, segments } = parseProjectPath(projectPath);
    const selectedFramework = framework ?? this.args.framework();
    const hostId = type === 'app' ? this.args.flag('host-id') : undefined;
    validateGeneratorOptions(
      this.options({ name, framework: selectedFramework, hostId }),
    );
    const explicit = this.args.flag('directory');
    const root =
      explicit && explicit !== 'true'
        ? resolve(explicit)
        : this.workspace.kind === 'nx' || segments.length > 1
          ? resolve(process.cwd(), ...segments)
          : this.workspace.generationRoot(type, name);
    const targetExisted = await exists(root);
    try {
      this.logGenerationPlan(selectedFramework, root);
      await ensureWorkspaceGenerator(this.context(), selectedFramework);
      const innerRouting = await resolveInnerRouting(this.context(), type);
      const stylesheetFormat = await resolveStylesheetFormat(
        this.context(),
        selectedFramework,
      );
      const devServerPort = await resolveDevServerPort(this.context(), type);
      if (
        this.workspace.kind === 'nx' &&
        !this.args.hasFlag('skip-workspace-generator') &&
        this.prompts.interactive
      ) {
        this.prompts.close();
      }
      const workspaceScaffolded =
        !this.args.hasFlag('skip-workspace-generator') &&
        (await this.workspace.scaffoldProject({
          type,
          name,
          framework: selectedFramework,
          projectRoot: root,
          devServerPort,
          interactive: this.prompts.interactive,
          routing: innerRouting,
          stylesheetFormat,
        }));
      const packageName = workspaceScaffolded
        ? await existingPackageName(root)
        : undefined;
      const scaffoldedFrameworkVersion = workspaceScaffolded
        ? await existingFrameworkVersionInfo(
            root,
            this.workspace.root,
            selectedFramework,
          )
        : undefined;
      if (scaffoldedFrameworkVersion)
        this.logFrameworkVersionSelection(
          selectedFramework,
          scaffoldedFrameworkVersion,
        );
      const detectedFrameworkVersion = scaffoldedFrameworkVersion?.version;
      const generatorOptions = this.options({
        name,
        framework: selectedFramework,
        packageName,
        detectedFrameworkVersion,
        hostId,
        routing: innerRouting,
        stylesheetFormat,
        devServerPort,
      });
      const files =
        type === 'host'
          ? generateHostFiles(generatorOptions)
          : generateAppFiles(generatorOptions);
      if (workspaceScaffolded) {
        await takeOverAppSource(root);
        if (selectedFramework === 'react')
          await removeDelegatedReactViteConfigs(root);
      }
      await writeGenerated(
        root,
        generatedOverlay(files, workspaceScaffolded, type, selectedFramework),
        workspaceScaffolded || this.args.hasFlag('force'),
      );
      if (selectedFramework === 'angular')
        await ensureAngularWorkspaceFederationConfig(
          root,
          name,
          type,
          devServerPort,
        );
      if (workspaceScaffolded) {
        await alignDelegatedTsconfig(root, selectedFramework);
        if (selectedFramework === 'angular')
          await alignDelegatedAngularFederationConfig(
            this.workspace.root,
            root,
          );
        if (this.workspace.kind === 'nx')
          await ensureDelegatedNxTargets(
            this.workspace.root,
            root,
            name,
            type,
            selectedFramework,
            this.workspace.packageManager,
            devServerPort,
            generatorOptions.frameworkVersion,
          );
        await this.mergeDelegatedDependencies(root, files, selectedFramework);
      }
      if (this.workspace.kind === 'nx' && !workspaceScaffolded)
        await writeNxProject({
          workspaceRoot: this.workspace.root,
          packageManager: this.workspace.packageManager,
          root,
          name,
          type,
        });
      if (this.workspace.kind === 'turbo')
        await ensureTurboTasks(this.workspace.root);
      await this.formatGenerated(root);
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
    for (const file of generateWidgetFiles({
      name,
      framework: app.framework,
    })) {
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

  private logGenerationPlan(framework: SupportedFramework, root: string): void {
    const label = workspaceLabel(this.workspace.kind);
    const target = displayTarget(this.workspace.root, root);
    ui.info(`Detected ${label} at ${this.workspace.root}.`);
    if (
      this.workspace.kind === 'nx' &&
      !this.args.hasFlag('skip-workspace-generator')
    ) {
      const generator =
        framework === 'angular'
          ? '@nx/angular:application'
          : '@nx/react:application';
      ui.info(
        `Delegating ${frameworkLabel(framework)} scaffolding to ${generator} at ${target}.`,
      );
      return;
    }
    const reason =
      this.workspace.kind === 'nx' ? 'Native Nx scaffolding was skipped; ' : '';
    ui.info(
      `${reason}Atlas will generate the ${frameworkLabel(framework)} scaffold directly at ${target}.`,
    );
  }

  private logFrameworkVersionSelection(
    framework: SupportedFramework,
    detected: FrameworkVersionInfo,
  ): void {
    const requested = this.args.flag('framework-version');
    const label = frameworkLabel(framework);
    const source = displayTarget(this.workspace.root, detected.manifest);
    if (requested && requested !== detected.version) {
      ui.warning(
        `Detected existing ${label} version ${detected.version} in ${source}; ignoring --framework-version=${requested} so Atlas does not change the workspace framework major.`,
      );
    } else {
      ui.info(
        `Detected existing ${label} version ${detected.version} in ${source}; Atlas will align ${label} companion dependencies to it.`,
      );
    }
  }

  private options(options: {
    name: string;
    framework?: SupportedFramework;
    packageName?: string;
    detectedFrameworkVersion?: string;
    hostId?: string;
    routing?: boolean;
    stylesheetFormat?: AngularStylesheetFormat;
    devServerPort?: number;
  }): AtlasGeneratorOptions {
    return {
      name: options.name,
      packageName: options.packageName,
      framework: options.framework ?? this.args.framework(),
      hostId: options.hostId,
      routing: options.routing,
      stylesheetFormat: options.stylesheetFormat,
      devServerPort: options.devServerPort,
      frameworkVersion:
        options.detectedFrameworkVersion ?? this.args.flag('framework-version'),
      allowUnsupportedVersion: this.args.hasFlag('allow-unsupported-version'),
    };
  }

  private async mergeDelegatedDependencies(
    root: string,
    files: AtlasGeneratedFile[],
    framework: SupportedFramework,
  ): Promise<void> {
    const packageFile = files.find((file) => file.path === 'package.json');
    if (!packageFile) return;
    const target = await dependencyManifestPath(root, this.workspace.root);
    const changed = await mergePackageDependencies(
      target,
      packageFile.contents,
      framework,
    );
    if (changed)
      ui.info(
        `Added Atlas dependencies to ${displayTarget(this.workspace.root, target)}.`,
      );
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
    if (await this.workspace.formatGenerated(root)) {
      ui.info(
        `Formatted generated files in ${displayTarget(this.workspace.root, root)}.`,
      );
    }
  }
}
