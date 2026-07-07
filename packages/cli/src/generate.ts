import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
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
      const files = type === "host"
        ? generateHostFiles(this.options(name, selectedFramework, packageName))
        : generateMicrofrontendFiles(this.options(name, selectedFramework, packageName));
      await writeGenerated(root, generatedOverlay(files, workspaceScaffolded), workspaceScaffolded || this.args.hasFlag("force"));
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

  private options(name: string, framework?: SupportedFramework, packageName?: string): AtlasGeneratorOptions {
    return {
      name,
      packageName,
      framework: framework ?? this.args.framework(),
      frameworkVersion: this.args.flag("framework-version"),
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

function generatedOverlay(files: AtlasGeneratedFile[], workspaceScaffolded: boolean): AtlasGeneratedFile[] {
  if (!workspaceScaffolded) return files;
  // A delegated generator owns the complete application scaffold. Keep this
  // allowlist deliberately small so new portable-template files cannot leak
  // into framework-managed projects by default.
  return files.filter((file) => ATLAS_INTEGRATION_FILES.has(file.path));
}

const ATLAS_INTEGRATION_FILES = new Set([
  "atlas.config.ts",
  "tsconfig.atlas.json",
  "federation.config.js",
  "public/atlas.runtime.json"
]);

async function existingPackageName(root: string): Promise<string | undefined> {
  try {
    const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as { name?: unknown };
    return typeof packageJson.name === "string" && packageJson.name ? packageJson.name : undefined;
  } catch {
    return undefined;
  }
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
