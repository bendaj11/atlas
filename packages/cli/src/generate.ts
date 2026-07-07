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
import type { AtlasPrompter } from "./ui.js";
import type { AtlasWorkspace } from "./workspace.js";

export class AtlasGenerateService {
  constructor(
    private readonly workspace: AtlasWorkspace,
    private readonly args: CliArguments,
    private readonly prompts: AtlasPrompter
  ) {}

  async project(
    type: "host" | "app",
    name: string,
    framework?: SupportedFramework,
    afterGeneration?: (root: string) => Promise<void>
  ): Promise<string> {
    assertSafeId(name, "project name");
    const selectedFramework = framework ?? this.args.framework();
    const explicit = this.args.flag("directory");
    const root = explicit && explicit !== "true" ? resolve(explicit) : this.defaultRoot(type, name);
    const targetExisted = await exists(root);
    try {
      await this.ensureWorkspaceGenerator(selectedFramework);
      const workspaceScaffolded = !this.args.hasFlag("skip-workspace-generator")
        && await this.workspace.scaffoldProject({ type, name, framework: selectedFramework, projectRoot: root });
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

function generatedOverlay(files: AtlasGeneratedFile[], workspaceScaffolded: boolean): AtlasGeneratedFile[] {
  if (!workspaceScaffolded) return files;
  // Framework generators own monorepo project configuration. In particular,
  // Nx configures Angular applications in project.json, never angular.json.
  return files.filter((file) => file.path !== "angular.json");
}

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
