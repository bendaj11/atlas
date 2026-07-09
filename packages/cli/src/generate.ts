import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  generateHostFiles,
  generateAppFiles,
  generateWidgetFiles,
  type AtlasGeneratedFile,
  type AtlasGeneratorOptions
} from "@atlas/generators";
import { CliArguments, type SupportedFramework } from "./arguments.js";
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
        // Release stdin from any Atlas prompt before Nx takes over the terminal.
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

  private options(name: string, framework?: SupportedFramework, packageName?: string, detectedFrameworkVersion?: string, hostId?: string): AtlasGeneratorOptions {
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
    await writeFile(join(root, "project.json"), `${JSON.stringify({ name, sourceRoot: `${cwd}/src`, projectType: "application", targets }, null, 2)}\n`, "utf8");
  }

  private async mergeDelegatedDependencies(root: string, files: AtlasGeneratedFile[], framework: SupportedFramework): Promise<void> {
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

function workspaceLabel(kind: AtlasWorkspace["kind"]): string {
  if (kind === "nx") return "an Nx workspace";
  if (kind === "turbo") return "a Turborepo workspace";
  if (kind === "workspace") return "a package-manager workspace";
  return "a standalone project";
}

function frameworkLabel(framework: SupportedFramework): string {
  return framework === "angular" ? "Angular" : "React";
}

function displayTarget(workspaceRoot: string, root: string): string {
  const target = relative(workspaceRoot, root);
  return !target || target === "." ? "." : target.startsWith(`..${sep}`) || isAbsolute(target) ? root : target;
}

function parseProjectPath(value: string): { name: string; segments: string[] } {
  const segments = value.split(/[\\/]/);
  if (segments.length === 0 || segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error(`Invalid project name or path "${value}". Use a relative path with safe directory names.`);
  }
  segments.forEach((segment) => assertSafeId(segment, "project name or path segment"));
  return { name: segments.at(-1)!, segments };
}

function generatedOverlay(
  files: AtlasGeneratedFile[],
  workspaceScaffolded: boolean,
  type: "host" | "app",
  framework: SupportedFramework
): AtlasGeneratedFile[] {
  if (!workspaceScaffolded) return files;
  // A delegated generator owns the complete application scaffold. Keep this
  // allowlist deliberately small so new portable-template files cannot leak
  // into framework-managed projects by default.
  const overlay = type === "host" ? DELEGATED_HOST_FILES[framework] : DELEGATED_APP_FILES[framework];
  return files.filter((file) => overlay.has(file.path));
}

const ATLAS_INTEGRATION_FILES = new Set([
  "atlas.config.ts",
  "federation.config.js"
]);

const DELEGATED_HOST_FILES: Record<SupportedFramework, ReadonlySet<string>> = {
  angular: new Set([
    ...ATLAS_INTEGRATION_FILES,
    "src/index.html",
    "src/styles.css",
    "src/app/app.component.ts",
    "src/main.ts",
    "src/bootstrap.ts"
  ]),
  react: new Set([
    ...ATLAS_INTEGRATION_FILES,
    "index.html",
    "src/styles.css",
    "src/main.tsx"
  ])
};

const DELEGATED_APP_FILES: Record<SupportedFramework, ReadonlySet<string>> = {
  angular: new Set([
    ...ATLAS_INTEGRATION_FILES,
    "src/index.html",
    "src/styles.css",
    "src/assets/.gitkeep",
    "src/main.ts",
    "src/app/README.md",
    "src/app/app.component.ts",
    "src/app/home/home.component.ts",
    "src/app/details/details.component.ts",
    "src/app/routes.ts",
    "src/entry.ts",
    "src/exported-widgets/README.md"
  ]),
  react: new Set([
    ...ATLAS_INTEGRATION_FILES,
    "vite.config.ts",
    "index.html",
    "src/styles.css",
    "src/app/README.md",
    "src/app/App.tsx",
    "src/app/home/Home.tsx",
    "src/app/details/Details.tsx",
    "src/app/routes.tsx",
    "src/main.tsx",
    "src/entry.tsx",
    "src/exported-widgets/README.md"
  ])
};

async function existingPackageName(root: string): Promise<string | undefined> {
  try {
    const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as { name?: unknown };
    return typeof packageJson.name === "string" && packageJson.name ? packageJson.name : undefined;
  } catch {
    return undefined;
  }
}

interface FrameworkVersionInfo {
  version: string;
  manifest: string;
}

async function existingFrameworkVersionInfo(root: string, workspaceRoot: string, framework: SupportedFramework): Promise<FrameworkVersionInfo | undefined> {
  try {
    const manifest = await dependencyManifestPath(root, workspaceRoot);
    const packageJson = JSON.parse(await readFile(manifest, "utf8")) as PackageJson;
    const dependency = framework === "angular" ? "@angular/core" : "react";
    for (const field of DEPENDENCY_FIELDS) {
      const version = asStringRecord(packageJson[field])[dependency];
      if (version) return { version, manifest };
    }
  } catch {
    return undefined;
  }
  return undefined;
}

async function dependencyManifestPath(projectRoot: string, workspaceRoot: string): Promise<string> {
  let current = projectRoot;
  const boundary = resolve(workspaceRoot);
  while (true) {
    const manifest = join(current, "package.json");
    if (await exists(manifest)) return manifest;
    const parent = dirname(current);
    if (resolve(current) === boundary || parent === current) break;
    current = parent;
  }
  const workspaceManifest = join(workspaceRoot, "package.json");
  if (await exists(workspaceManifest)) return workspaceManifest;
  throw new Error(`Could not find package.json for generated project at ${projectRoot}.`);
}

async function mergePackageDependencies(targetPackageJson: string, generatedPackageJson: string, framework: SupportedFramework): Promise<boolean> {
  const target = JSON.parse(await readFile(targetPackageJson, "utf8")) as PackageJson;
  const generated = JSON.parse(generatedPackageJson) as PackageJson;
  const primaryDependency = frameworkPrimaryDependency(framework);
  const hasPrimaryDependency = dependencyDeclared(target, primaryDependency);
  let changed = false;
  for (const field of DEPENDENCY_FIELDS) {
    const incoming = asStringRecord(generated[field]);
    if (!Object.keys(incoming).length) continue;
    for (const [name, version] of Object.entries(incoming)) {
      const existingField = dependencyField(target, name);
      if (existingField) {
        if (hasPrimaryDependency && isFrameworkManagedDependency(framework, name)) {
          const existing = asStringRecord(target[existingField]);
          if (existing[name] !== version) {
            existing[name] = version;
            target[existingField] = sortObject(existing);
            changed = true;
          }
        }
        continue;
      }
      const current = asStringRecord(target[field]);
      current[name] = version;
      target[field] = current;
      changed = true;
    }
    target[field] = sortObject(asStringRecord(target[field]));
  }
  if (!changed) return false;
  await writeFile(targetPackageJson, `${JSON.stringify(target, null, 2)}\n`, "utf8");
  return true;
}

const DEPENDENCY_FIELDS = ["dependencies", "devDependencies"] as const;

type DependencyField = typeof DEPENDENCY_FIELDS[number];
type PackageJson = Record<string, unknown> & Partial<Record<DependencyField, unknown>>;

function dependencyDeclared(packageJson: PackageJson, name: string): boolean {
  return dependencyField(packageJson, name) !== undefined;
}

function dependencyField(packageJson: PackageJson, name: string): DependencyField | undefined {
  return DEPENDENCY_FIELDS.find((field) => name in asStringRecord(packageJson[field]));
}

function frameworkPrimaryDependency(framework: SupportedFramework): string {
  return framework === "angular" ? "@angular/core" : "react";
}

function isFrameworkManagedDependency(framework: SupportedFramework, name: string): boolean {
  if (framework === "angular") {
    return name.startsWith("@angular/")
      || name === "@angular-architects/native-federation"
      || name === "typescript"
      || name === "zone.js";
  }
  return name === "react"
    || name === "react-dom"
    || name === "@types/react"
    || name === "@types/react-dom"
    || name === "react-router-dom"
    || name === "react-compiler-runtime";
}

function asStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

function sortObject(value: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}

function nxTarget(packageManager: "yarn" | "pnpm" | "npm", cwd: string, script: string): Record<string, unknown> {
  return { executor: "nx:run-commands", options: { cwd, command: `${packageManager} run ${script}` } };
}

function atlasConfigNxTarget(packageManager: "yarn" | "pnpm" | "npm", cwd: string): Record<string, unknown> {
  return { ...nxTarget(packageManager, cwd, "atlas:config"), outputs: ["{projectRoot}/.atlas"] };
}

async function writeGenerated(root: string, files: AtlasGeneratedFile[], force: boolean): Promise<void> {
  await assertWritable(root, force, `Target directory "${root}" already exists. Use --force to update generated files.`);
  for (const file of files) {
    const target = resolveContainedPath(root, file.path);
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, file.contents, "utf8");
  }
}

async function takeOverAppSource(root: string): Promise<void> {
  await rm(resolveContainedPath(root, "src/app"), { recursive: true, force: true });
}

async function alignDelegatedTsconfig(root: string, framework: SupportedFramework): Promise<void> {
  const appTsconfig = join(root, "tsconfig.app.json");
  const target = await exists(appTsconfig) ? appTsconfig : join(root, "tsconfig.json");
  if (!await exists(target)) return;

  const tsconfig = JSON.parse(await readFile(target, "utf8")) as Record<string, unknown>;
  const compilerOptions = typeof tsconfig.compilerOptions === "object" && tsconfig.compilerOptions && !Array.isArray(tsconfig.compilerOptions)
    ? tsconfig.compilerOptions as Record<string, unknown>
    : {};
  if (framework === "angular") {
    compilerOptions.emitDeclarationOnly = false;
    tsconfig.compilerOptions = compilerOptions;
    await writeFile(target, `${JSON.stringify(tsconfig, null, 2)}\n`, "utf8");
    return;
  }

  if (framework === "react") {
    compilerOptions.module = "ESNext";
    compilerOptions.moduleResolution = "bundler";
    compilerOptions.types = addUniqueString(Array.isArray(compilerOptions.types) ? compilerOptions.types : [], "vite/client");
    tsconfig.compilerOptions = compilerOptions;
  }
  if (Array.isArray(tsconfig.files)) {
    tsconfig.files = addUniqueString(tsconfig.files, "atlas.config.ts");
  } else {
    tsconfig.include = addUniqueString(Array.isArray(tsconfig.include) ? tsconfig.include : [], "atlas.config.ts");
  }
  await writeFile(target, `${JSON.stringify(tsconfig, null, 2)}\n`, "utf8");
}

async function ensureDelegatedNxTargets(workspaceRoot: string, root: string, name: string, type: "host" | "app", framework: SupportedFramework): Promise<void> {
  const projectFile = join(root, "project.json");
  const project = await readJsonFile<Record<string, unknown>>(projectFile);
  if (!project) return;

  const projectName = typeof project.name === "string" && project.name ? project.name : name;
  const projectRoot = normalizedProjectRoot(workspaceRoot, root);
  const previousProjectRoot = projectRootFromNxProject(project, workspaceRoot, root);
  if (previousProjectRoot !== projectRoot) {
    throw new Error(staleNxProjectRootMessage(project, previousProjectRoot, projectRoot));
  }
  const targets = asObject(project.targets);
  if (framework === "angular") ensureAngularNativeFederationTargets(targets, projectName, type, "executor");
  const atlasConfigTarget = {
    executor: "nx:run-commands",
    outputs: ["{projectRoot}/.atlas"],
    options: { command: `atlas compile-config ${projectName}` }
  };
  if (!targets["atlas:config"] || isOutdatedAtlasConfigTarget(targets["atlas:config"])) {
    targets["atlas:config"] = atlasConfigTarget;
  }
  if (!targets.dev && targets.serve) {
    targets.dev = type === "host"
      ? {
          executor: "nx:run-commands",
          options: {
            commands: [
              { command: `atlas runtime-config ${projectName}` },
              { command: `nx run ${projectName}:serve`, forwardAllArgs: true }
            ],
            parallel: false
          }
        }
      : {
          executor: "nx:run-commands",
          options: { command: `nx run ${projectName}:serve`, forwardAllArgs: true }
        };
  }
  if (targets.dev && !targets[projectName]) {
    targets[projectName] = {
      executor: "nx:run-commands",
      options: { command: `nx run ${projectName}:dev`, forwardAllArgs: true }
    };
  }
  project.targets = targets;
  await writeFile(projectFile, `${JSON.stringify(project, null, 2)}\n`, "utf8");
}

async function ensureAngularWorkspaceFederationConfig(root: string, projectName: string, type: "host" | "app"): Promise<void> {
  const workspaceFile = join(root, "angular.json");
  const workspace = await readJsonFile<Record<string, unknown>>(workspaceFile);
  if (!workspace) return;
  const project = asObject(asObject(workspace.projects)[projectName]);
  const targets = asObject(project.architect);
  if (!Object.keys(targets).length) return;
  ensureAngularNativeFederationTargets(targets, projectName, type, "builder");
  project.architect = targets;
  asObject(workspace.projects)[projectName] = project;
  await writeFile(workspaceFile, `${JSON.stringify(workspace, null, 2)}\n`, "utf8");
}

function ensureAngularNativeFederationTargets(
  targets: Record<string, unknown>,
  projectName: string,
  type: "host" | "app",
  runnerKey: "builder" | "executor"
): void {
  if (targets.build && !isNativeFederationTarget(targets.build, runnerKey)) {
    targets.esbuild ??= targets.build;
  }
  if (targets.esbuild) {
    targets.build = {
      [runnerKey]: "@angular-architects/native-federation:build",
      options: { target: `${projectName}:esbuild:production` },
      configurations: {
        development: { target: `${projectName}:esbuild:development`, dev: true }
      }
    };
  }

  if (targets.serve && !isNativeFederationTarget(targets.serve, runnerKey)) {
    targets["serve-original"] ??= targets.serve;
  }
  if (targets["serve-original"]) {
    retargetAngularServeBuild(targets["serve-original"], projectName);
    targets.serve = {
      [runnerKey]: "@angular-architects/native-federation:build",
      options: {
        target: `${projectName}:serve-original:development`,
        dev: true,
        port: type === "host" ? 4200 : 4201
      }
    };
  }
}

function retargetAngularServeBuild(target: unknown, projectName: string): void {
  const serveTarget = asObject(target);
  retargetAngularBuildReference(asObject(serveTarget.options), projectName);
  for (const configuration of Object.values(asObject(serveTarget.configurations))) {
    retargetAngularBuildReference(asObject(configuration), projectName);
  }
}

function retargetAngularBuildReference(options: Record<string, unknown>, projectName: string): void {
  for (const key of ["buildTarget", "browserTarget"]) {
    const value = options[key];
    if (typeof value === "string") options[key] = retargetAngularBuildTarget(value, projectName);
  }
}

function retargetAngularBuildTarget(value: string, projectName: string): string {
  const [targetProject, targetName, ...rest] = value.split(":");
  if (targetProject !== projectName || targetName !== "build") return value;
  return [targetProject, "esbuild", ...rest].join(":");
}

function isNativeFederationTarget(value: unknown, runnerKey: "builder" | "executor"): boolean {
  return asObject(value)[runnerKey] === "@angular-architects/native-federation:build";
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function isOutdatedAtlasConfigTarget(value: unknown): boolean {
  const target = asObject(value);
  const options = asObject(target.options);
  return typeof options.command !== "string" || options.command.includes("tsconfig.atlas.json") || !declaresAtlasConfigOutput(target);
}

function declaresAtlasConfigOutput(target: Record<string, unknown>): boolean {
  return Array.isArray(target.outputs) && target.outputs.includes("{projectRoot}/.atlas");
}

function projectRootFromNxProject(project: Record<string, unknown>, workspaceRoot: string, root: string): string {
  const configuredRoot = typeof project.root === "string" && project.root ? project.root : undefined;
  return configuredRoot ?? normalizedProjectRoot(workspaceRoot, root);
}

function normalizedProjectRoot(workspaceRoot: string, root: string): string {
  return relative(workspaceRoot, root).split("\\").join("/") || ".";
}

function staleNxProjectRootMessage(project: Record<string, unknown>, configuredRoot: string, actualRoot: string): string {
  const stalePaths = staleNxProjectPaths(project, configuredRoot);
  const examples = stalePaths.length ? ` Stale paths: ${stalePaths.slice(0, 3).join(", ")}.` : "";
  return `Nx project root mismatch. project.json points at "${configuredRoot}", but Atlas generated the project at "${actualRoot}".${examples} Update project.json root/sourceRoot/build options or regenerate the project.`;
}

function staleNxProjectPaths(project: Record<string, unknown>, configuredRoot: string): string[] {
  const prefix = configuredRoot === "." ? "" : `${configuredRoot}/`;
  if (!prefix) return [];
  const values = collectNxPathValues(project);
  return [...new Set(values.filter((value) => value.startsWith(prefix)))];
}

function collectNxPathValues(project: Record<string, unknown>): string[] {
  const values = typeof project.sourceRoot === "string" ? [project.sourceRoot] : [];
  const targets = asObject(project.targets);
  for (const target of Object.values(targets)) {
    const targetObject = asObject(target);
    values.push(...nxPathOptions(asObject(targetObject.options)));
    for (const configuration of Object.values(asObject(targetObject.configurations))) {
      values.push(...nxPathOptions(asObject(configuration)));
    }
  }
  return values.map((value) => value.split("\\").join("/"));
}

function nxPathOptions(options: Record<string, unknown>): string[] {
  return ["index", "browser", "main", "polyfills", "tsConfig", "styles"].flatMap((key) => {
    const value = options[key];
    if (typeof value === "string") return [value];
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
    return [];
  });
}

async function readJsonFile<T>(path: string): Promise<T | undefined> {
  try { return JSON.parse(await readFile(path, "utf8")) as T; }
  catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return undefined;
    throw error;
  }
}

function addUniqueString(values: unknown[], value: string): unknown[] {
  return values.includes(value) ? values : [...values, value];
}

async function assertWritable(path: string, force: boolean, message: string): Promise<void> {
  if (force) return;
  try { await access(path); throw new Error(message); }
  catch (error) { if (!isNodeError(error) || error.code !== "ENOENT") throw error; }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException { return error instanceof Error && "code" in error; }

async function exists(path: string): Promise<boolean> {
  try { await access(path); return true; }
  catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return false;
    throw error;
  }
}

function assertSafeId(value: string, subject: string): void {
  if (!/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/i.test(value) || value === "." || value === "..") {
    throw new Error(`Invalid ${subject} "${value}". Use letters, numbers, dots, underscores, or hyphens.`);
  }
}

function resolveContainedPath(root: string, path: string): string {
  const target = resolve(root, path);
  const relativePath = relative(resolve(root), target);
  if (relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    throw new Error(`Generated path "${path}" escapes its target directory.`);
  }
  return target;
}
