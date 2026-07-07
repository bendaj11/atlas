import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  generateHostFiles,
  generateMicrofrontendFiles,
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
        : generateMicrofrontendFiles(this.options(name, selectedFramework, packageName, detectedFrameworkVersion, hostId));
      await writeGenerated(root, generatedOverlay(files, workspaceScaffolded, type, selectedFramework), workspaceScaffolded || this.args.hasFlag("force"));
      if (workspaceScaffolded) await this.mergeDelegatedDependencies(root, files, selectedFramework);
      if (this.workspace.kind === "nx" && !workspaceScaffolded) await this.writeNxProject(root, name);
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
    targets["atlas:config"] = nxTarget(this.workspace.packageManager, cwd, "atlas:config");
    await writeFile(join(root, "project.json"), `${JSON.stringify({ name, sourceRoot: `${cwd}/src`, projectType: "application", targets }, null, 2)}\n`, "utf8");
  }

  private async mergeDelegatedDependencies(root: string, files: AtlasGeneratedFile[], framework: SupportedFramework): Promise<void> {
    const packageFile = files.find((file) => file.path === "package.json");
    if (!packageFile) return;
    const target = await dependencyManifestPath(root, this.workspace.root);
    const changed = await mergePackageDependencies(target, packageFile.contents, framework);
    if (changed) ui.info(`Added Atlas dependencies to ${displayTarget(this.workspace.root, target)}.`);
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
  const overlay = type === "host" ? DELEGATED_HOST_FILES[framework] : DELEGATED_MF_FILES[framework];
  return files.filter((file) => overlay.has(file.path));
}

const ATLAS_INTEGRATION_FILES = new Set([
  "atlas.config.ts",
  "tsconfig.atlas.json",
  "federation.config.js"
]);

const DELEGATED_HOST_FILES: Record<SupportedFramework, ReadonlySet<string>> = {
  angular: new Set([
    ...ATLAS_INTEGRATION_FILES,
    "src/index.html",
    "src/styles.css",
    "src/app.component.ts",
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

const DELEGATED_MF_FILES: Record<SupportedFramework, ReadonlySet<string>> = {
  angular: new Set([
    ...ATLAS_INTEGRATION_FILES,
    "src/index.html",
    "src/styles.css",
    "src/assets/.gitkeep",
    "src/main.ts",
    "src/app.component.ts",
    "src/entry.ts",
    "src/exported-components/README.md"
  ]),
  react: new Set([
    ...ATLAS_INTEGRATION_FILES,
    "vite.config.ts",
    "index.html",
    "src/styles.css",
    "src/entry.tsx",
    "src/exported-components/README.md"
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

function nxTarget(packageManager: "yarn" | "pnpm" | "npm", cwd: string, script: string): unknown {
  return { executor: "nx:run-commands", options: { cwd, command: `${packageManager} run ${script}` } };
}

async function writeGenerated(root: string, files: AtlasGeneratedFile[], force: boolean): Promise<void> {
  await assertWritable(root, force, `Target directory "${root}" already exists. Use --force to update generated files.`);
  for (const file of files) {
    const target = resolveContainedPath(root, file.path);
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, file.contents, "utf8");
  }
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
