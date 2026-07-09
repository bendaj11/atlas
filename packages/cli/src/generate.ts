import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  generateAppFiles,
  generateHostFiles,
  generateWidgetFiles,
  type AtlasGeneratedFile,
  type AtlasGeneratorOptions
} from "@atlas/generators";
import { CliArguments, type SupportedFramework } from "./arguments.js";
import { ensureAngularWorkspaceFederationConfig } from "./generate-angular.js";
import {
  dependencyManifestPath,
  existingFrameworkVersionInfo,
  mergePackageDependencies,
  type FrameworkVersionInfo
} from "./generate-dependencies.js";
import { existingPackageName, exists, takeOverAppSource, writeGenerated } from "./generate-files.js";
import { frameworkLabel } from "./generate-labels.js";
import {
  alignDelegatedAngularFederationConfig,
  alignDelegatedTsconfig,
  atlasConfigNxTarget,
  ensureDelegatedNxTargets,
  nxTarget
} from "./generate-nx.js";
import { generatedOverlay } from "./generate-overlay.js";
import {
  assertSafeId,
  assertWritable,
  displayTarget,
  parseProjectPath,
  resolveContainedPath,
  workspaceLabel
} from "./generate-paths.js";
import { ui, type AtlasPrompter } from "./ui.js";
import type { AtlasWorkspace } from "./workspace.js";

export class AtlasGenerateService {
  constructor(
    private readonly workspace: AtlasWorkspace,
    private readonly args: CliArguments,
    private readonly prompts: AtlasPrompter
  ) {}

  async project(
    type: "host" | "app",
    projectPath: string,
    framework?: SupportedFramework,
    afterGeneration?: (root: string) => Promise<void>
  ): Promise<string> {
    const { name, segments } = parseProjectPath(projectPath);
    const selectedFramework = framework ?? this.args.framework();
    const explicit = this.args.flag("directory");
    const root = explicit && explicit !== "true"
      ? resolve(explicit)
      : this.workspace.kind === "nx" || segments.length > 1
        ? resolve(process.cwd(), ...segments)
        : this.defaultRoot(type, name);
    const targetExisted = await exists(root);
    try {
      this.logGenerationPlan(selectedFramework, root);
      await this.ensureWorkspaceGenerator(selectedFramework);
      if (this.workspace.kind === "nx" && !this.args.hasFlag("skip-workspace-generator") && this.prompts.interactive) {
        this.prompts.close();
      }
      const workspaceScaffolded = !this.args.hasFlag("skip-workspace-generator")
        && await this.workspace.scaffoldProject({
          type,
          name,
          framework: selectedFramework,
          projectRoot: root,
          interactive: this.prompts.interactive
        });
      const packageName = workspaceScaffolded ? await existingPackageName(root) : undefined;
      const scaffoldedFrameworkVersion = workspaceScaffolded
        ? await existingFrameworkVersionInfo(root, this.workspace.root, selectedFramework)
        : undefined;
      if (scaffoldedFrameworkVersion) this.logFrameworkVersionSelection(selectedFramework, scaffoldedFrameworkVersion);
      const detectedFrameworkVersion = scaffoldedFrameworkVersion?.version;
      const hostId = type === "app" ? this.args.flag("host") : undefined;
      const files = type === "host"
        ? generateHostFiles(this.options(name, selectedFramework, packageName, detectedFrameworkVersion))
        : generateAppFiles(this.options(name, selectedFramework, packageName, detectedFrameworkVersion, hostId));
      if (workspaceScaffolded) await takeOverAppSource(root);
      await writeGenerated(root, generatedOverlay(files, workspaceScaffolded, type, selectedFramework), workspaceScaffolded || this.args.hasFlag("force"));
      if (selectedFramework === "angular") await ensureAngularWorkspaceFederationConfig(root, name, type);
      if (workspaceScaffolded) {
        await alignDelegatedTsconfig(root, selectedFramework);
        if (selectedFramework === "angular") await alignDelegatedAngularFederationConfig(this.workspace.root, root);
        if (this.workspace.kind === "nx") await ensureDelegatedNxTargets(this.workspace.root, root, name, type, selectedFramework);
        await this.mergeDelegatedDependencies(root, files, selectedFramework);
      }
      if (this.workspace.kind === "nx" && !workspaceScaffolded) await this.writeNxProject(root, name);
      await this.formatGenerated(root);
      await afterGeneration?.(root);
      return root;
    } catch (error) {
      if (!targetExisted) await rm(root, { recursive: true, force: true });
      throw error;
    }
  }

  async installDependencies(projectRoot: string): Promise<void> {
    await this.workspace.installDependencies(projectRoot);
  }

  async widget(name: string, app: string): Promise<void> {
    assertSafeId(name, "widget name");
    const project = await this.workspace.findProject(app);
    const source = await readFile(join(project.root, "atlas.config.ts"), "utf8");
    const framework = source.match(/framework\s*:\s*["'](angular|react)["']/)?.[1] as SupportedFramework | undefined;
    if (!framework) throw new Error(`Could not determine the framework from ${join(project.root, "atlas.config.ts")}.`);
    for (const file of generateWidgetFiles({ name, framework })) {
      const target = resolveContainedPath(project.root, file.path);
      await assertWritable(target, this.args.hasFlag("force"), `Widget "${name}" already exists. Use --force to replace it.`);
      await mkdir(join(target, ".."), { recursive: true });
      await writeFile(target, file.contents, "utf8");
    }
    await this.formatGenerated(project.root);
  }

  private logGenerationPlan(framework: SupportedFramework, root: string): void {
    const label = workspaceLabel(this.workspace.kind);
    const target = displayTarget(this.workspace.root, root);
    ui.info(`Detected ${label} at ${this.workspace.root}.`);
    if (this.workspace.kind === "nx" && !this.args.hasFlag("skip-workspace-generator")) {
      const generator = framework === "angular" ? "@nx/angular:application" : "@nx/react:application";
      ui.info(`Delegating ${frameworkLabel(framework)} scaffolding to ${generator} at ${target}.`);
      return;
    }
    const reason = this.workspace.kind === "nx" ? "Native Nx scaffolding was skipped; " : "";
    ui.info(`${reason}Atlas will generate the ${frameworkLabel(framework)} scaffold directly at ${target}.`);
  }

  private async ensureWorkspaceGenerator(framework: SupportedFramework): Promise<void> {
    if (this.args.hasFlag("skip-workspace-generator")) return;
    const dependency = await this.workspace.missingScaffoldDependency(framework);
    if (!dependency) return;
    const approved = this.args.hasFlag("yes") || await this.confirmPluginInstall(dependency);
    if (!approved) throw new Error(`${dependency} is required to generate this Nx project.`);
    await this.workspace.installScaffoldDependency(framework);
  }

  private async confirmPluginInstall(dependency: string): Promise<boolean> {
    if (!this.prompts.interactive) {
      throw new Error(`${dependency} is not installed. Re-run with --yes to let Atlas add it automatically.`);
    }
    return await this.prompts.select(`Nx needs ${dependency}. Add it to this workspace?`, [
      { label: "Yes, install it", value: "yes" },
      { label: "No, cancel", value: "no" }
    ]) === "yes";
  }

  private logFrameworkVersionSelection(framework: SupportedFramework, detected: FrameworkVersionInfo): void {
    const requested = this.args.flag("framework-version");
    const label = frameworkLabel(framework);
    const source = displayTarget(this.workspace.root, detected.manifest);
    if (requested && requested !== detected.version) {
      ui.warning(`Detected existing ${label} version ${detected.version} in ${source}; ignoring --framework-version=${requested} so Atlas does not change the workspace framework major.`);
    } else {
      ui.info(`Detected existing ${label} version ${detected.version} in ${source}; Atlas will align ${label} companion dependencies to it.`);
    }
  }

  private options(
    name: string,
    framework?: SupportedFramework,
    packageName?: string,
    detectedFrameworkVersion?: string,
    hostId?: string
  ): AtlasGeneratorOptions {
    return {
      name,
      packageName,
      framework: framework ?? this.args.framework(),
      hostId,
      frameworkVersion: detectedFrameworkVersion ?? this.args.flag("framework-version"),
      allowUnsupportedVersion: this.args.hasFlag("allow-unsupported-version")
    };
  }

  private defaultRoot(type: "host" | "app", name: string): string {
    if (this.workspace.root.endsWith("/atlas") && this.workspace.kind === "workspace") {
      return join(this.workspace.root, "examples", type === "host" ? "hosts" : "mfs", name);
    }
    return this.workspace.generationRoot(type, name);
  }

  private async writeNxProject(root: string, name: string): Promise<void> {
    const cwd = relative(this.workspace.root, root) || ".";
    if (cwd === ".." || cwd.startsWith(`..${sep}`) || isAbsolute(cwd)) {
      throw new Error("Nx projects must be generated inside the workspace root.");
    }
    const targets: Record<string, unknown> = {
      build: nxTarget(this.workspace.packageManager, cwd, "build"),
      dev: nxTarget(this.workspace.packageManager, cwd, "dev")
    };
    targets["atlas:config"] = atlasConfigNxTarget(this.workspace.packageManager, cwd);
    targets[name] = {
      executor: "nx:run-commands",
      options: { command: `nx run ${name}:dev`, forwardAllArgs: true }
    };
    const project = { name, sourceRoot: `${cwd}/src`, projectType: "application", targets };
    await writeFile(join(root, "project.json"), `${JSON.stringify(project, null, 2)}\n`, "utf8");
  }

  private async mergeDelegatedDependencies(
    root: string,
    files: AtlasGeneratedFile[],
    framework: SupportedFramework
  ): Promise<void> {
    const packageFile = files.find((file) => file.path === "package.json");
    if (!packageFile) return;
    const target = await dependencyManifestPath(root, this.workspace.root);
    const changed = await mergePackageDependencies(target, packageFile.contents, framework);
    if (changed) ui.info(`Added Atlas dependencies to ${displayTarget(this.workspace.root, target)}.`);
  }

  private async formatGenerated(root: string): Promise<void> {
    if (this.args.hasFlag("skip-format")) return;
    if (await this.workspace.formatGenerated(root)) {
      ui.info(`Formatted generated files in ${displayTarget(this.workspace.root, root)}.`);
    }
  }
}
