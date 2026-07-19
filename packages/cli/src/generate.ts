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
import { existingPackageName, exists, removeDelegatedReactViteConfigs, takeOverAppSource, writeGenerated } from "./generate-files.js";
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
import { readJsonFile, writeJsonFile } from "./generate-json.js";
import { defaultDevServerPort, type AtlasNxProjectType, type AtlasWorkspace } from "./workspace.js";

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
    afterGeneration?: (roots: string[]) => Promise<void>
  ): Promise<string[]> {
    if (type === "app" && this.args.hasFlag("host")) {
      throw new Error('Unknown option "--host" for app generation. Use --host-id.');
    }
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
      await this.ensureWorkspaceGeneratorAvailable(selectedFramework);
      const innerRouting = await this.resolveInnerRouting(type);
      const devServerPort = await this.resolveDevServerPort(type);
      if (this.workspace.kind === "nx" && !this.args.hasFlag("skip-workspace-generator") && this.prompts.interactive) {
        this.prompts.close();
      }
      const workspaceScaffolded = !this.args.hasFlag("skip-workspace-generator")
        && await this.workspace.scaffoldProject({
          type,
          name,
          framework: selectedFramework,
          projectRoot: root,
          devServerPort,
          interactive: this.prompts.interactive,
          routing: innerRouting
        });
      const packageName = workspaceScaffolded ? await existingPackageName(root) : undefined;
      const scaffoldedFrameworkVersion = workspaceScaffolded
        ? await existingFrameworkVersionInfo(root, this.workspace.root, selectedFramework)
        : undefined;
      if (scaffoldedFrameworkVersion) this.logFrameworkVersionSelection(selectedFramework, scaffoldedFrameworkVersion);
      const detectedFrameworkVersion = scaffoldedFrameworkVersion?.version;
      const hostId = type === "app" ? this.args.flag("host-id") : undefined;
      const generatorOptions = this.options({
        name,
        framework: selectedFramework,
        packageName,
        detectedFrameworkVersion,
        hostId,
        routing: innerRouting,
        devServerPort
      });
      const files = type === "host" ? generateHostFiles(generatorOptions) : generateAppFiles(generatorOptions);
      if (workspaceScaffolded) {
        await takeOverAppSource(root);
        if (selectedFramework === "react") await removeDelegatedReactViteConfigs(root);
      }
      await writeGenerated(root, generatedOverlay(files, workspaceScaffolded, type, selectedFramework), workspaceScaffolded || this.args.hasFlag("force"));
      if (selectedFramework === "angular") await ensureAngularWorkspaceFederationConfig(root, name, type, devServerPort);
      if (workspaceScaffolded) {
        await alignDelegatedTsconfig(root, selectedFramework);
        if (selectedFramework === "angular") await alignDelegatedAngularFederationConfig(this.workspace.root, root);
        if (this.workspace.kind === "nx") await ensureDelegatedNxTargets(this.workspace.root, root, name, type, selectedFramework, devServerPort);
        await this.mergeDelegatedDependencies(root, files, selectedFramework);
      }
      if (this.workspace.kind === "nx" && !workspaceScaffolded) await this.writeNxProject(root, name, type);
      if (this.workspace.kind === "turbo") await this.ensureTurboTasks();
      await this.formatGenerated(root);
      const roots = [root];
      await afterGeneration?.(roots);
      return roots;
    } catch (error) {
      if (!targetExisted) await rm(root, { recursive: true, force: true });
      throw error;
    }
  }

  async installDependencies(projectRoots: string[]): Promise<void> {
    if (this.workspace.kind !== "standalone") {
      await this.workspace.installDependencies(this.workspace.root);
      return;
    }
    for (const projectRoot of projectRoots) await this.workspace.installDependencies(projectRoot);
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

  private async ensureWorkspaceGeneratorAvailable(framework: SupportedFramework): Promise<void> {
    if (this.args.hasFlag("skip-workspace-generator")) return;
    await this.ensureWorkspaceGenerator(framework);
  }

  private async ensureWorkspaceGenerator(projectType: AtlasNxProjectType): Promise<void> {
    const dependency = await this.workspace.missingScaffoldDependency(projectType);
    if (!dependency) return;
    const approved = this.args.hasFlag("yes") || await this.confirmPluginInstall(dependency);
    if (!approved) throw new Error(`${dependency} is required to generate this Nx project.`);
    await this.workspace.installScaffoldDependency(projectType);
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

  private async resolveInnerRouting(type: "host" | "app"): Promise<boolean> {
    if (type === "host") return true;
    if (this.args.hasFlag("routing") || this.args.hasFlag("no-routing")) return this.args.routing();
    if (!this.prompts.interactive) return true;
    return await this.prompts.select("Add Atlas inner routing to this app?", [
      { label: "Yes, create sample routes", value: "true" },
      { label: "No, single-page app", value: "false" }
    ]) === "true";
  }

  private async resolveDevServerPort(type: "host" | "app"): Promise<number> {
    const fallback = defaultDevServerPort(type);
    if (this.args.hasFlag("port")) return this.args.port("port", fallback);
    if (!this.prompts.interactive) return fallback;
    while (true) {
      const value = await this.prompts.input("Which port would you like to use for the dev server?", String(fallback));
      const port = Number(value);
      if (Number.isInteger(port) && port >= 1 && port <= 65535) return port;
      ui.warning("Port must be an integer between 1 and 65535.");
    }
  }

  private options(options: {
    name: string;
    framework?: SupportedFramework;
    packageName?: string;
    detectedFrameworkVersion?: string;
    hostId?: string;
    routing?: boolean;
    devServerPort?: number;
  }): AtlasGeneratorOptions {
    return {
      name: options.name,
      packageName: options.packageName,
      framework: options.framework ?? this.args.framework(),
      hostId: options.hostId,
      routing: options.routing,
      devServerPort: options.devServerPort,
      frameworkVersion: options.detectedFrameworkVersion ?? this.args.flag("framework-version"),
      allowUnsupportedVersion: this.args.hasFlag("allow-unsupported-version")
    };
  }

  private defaultRoot(type: "host" | "app", name: string): string {
    if (this.workspace.root.endsWith("/atlas") && this.workspace.kind === "workspace") {
      return join(this.workspace.root, "examples", type === "host" ? "hosts" : "apps", name);
    }
    return this.workspace.generationRoot(type, name);
  }

  private async writeNxProject(root: string, name: string, type: "host" | "app"): Promise<void> {
    const cwd = relative(this.workspace.root, root) || ".";
    if (cwd === ".." || cwd.startsWith(`..${sep}`) || isAbsolute(cwd)) {
      throw new Error("Nx projects must be generated inside the workspace root.");
    }
    const targets: Record<string, unknown> = {
      build: nxTarget(this.workspace.packageManager, cwd, "build"),
      serve: nxTarget(this.workspace.packageManager, cwd, "dev"),
      dev: {
        executor: "nx:run-commands",
        options: { command: `atlas dev ${name}`, forwardAllArgs: true }
      }
    };
    targets["atlas:config"] = atlasConfigNxTarget(this.workspace.packageManager, cwd);
    targets["atlas:publish"] = {
      cache: false,
      dependsOn: ["build"],
      executor: "nx:run-commands",
      options: { command: `atlas publish ${name} --from-build-output`, forwardAllArgs: true }
    };
    if (type === "host") {
      targets["atlas:bootstrap"] = {
        dependsOn: ["atlas:config"],
        outputs: ["{projectRoot}/dist/bootstrap"],
        executor: "nx:run-commands",
        options: { command: `atlas build-bootstrap ${name} --skip-compile`, forwardAllArgs: true }
      };
    }
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

  private async ensureTurboTasks(): Promise<void> {
    const turboPath = join(this.workspace.root, "turbo.json");
    const turbo = await readJsonFile<Record<string, unknown>>(turboPath);
    if (!turbo) return;
    const tasks = turbo.tasks && typeof turbo.tasks === "object" && !Array.isArray(turbo.tasks)
      ? turbo.tasks as Record<string, unknown>
      : {};
    tasks["atlas:config"] ??= { outputs: [".atlas/**"] };
    tasks["atlas:publish"] ??= {
      cache: false,
      dependsOn: ["build"],
      env: [
        "ATLAS_*", "AWS_*", "CI_*", "GITHUB_*", "BITBUCKET_*", "VERCEL_*"
      ]
    };
    tasks["atlas:bootstrap"] ??= {
      dependsOn: ["atlas:config"],
      outputs: ["dist/bootstrap/**"]
    };
    turbo.tasks = tasks;
    await writeJsonFile(turboPath, turbo);
  }

  private async formatGenerated(root: string): Promise<void> {
    if (this.args.hasFlag("skip-format")) return;
    if (await this.workspace.formatGenerated(root)) {
      ui.info(`Formatted generated files in ${displayTarget(this.workspace.root, root)}.`);
    }
  }
}
