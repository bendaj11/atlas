import { access, readFile, readdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import type { ChildProcess } from "node:child_process";
import { runProcess, spawnProcess, type ProcessCommand } from "./process.js";

export type AtlasWorkspaceKind = "nx" | "turbo" | "workspace" | "standalone";
export type AtlasPackageManager = "yarn" | "pnpm" | "npm";
export type AtlasTask = "atlas:config" | "build" | "dev" | "serve";

export interface AtlasProject {
  id: string;
  root: string;
  packageName: string;
  version: string;
  outputPaths: string[];
}

export interface AtlasWorkspace {
  kind: AtlasWorkspaceKind;
  root: string;
  packageManager: AtlasPackageManager;
  findProject(name: string): Promise<AtlasProject>;
  run(project: AtlasProject, task: AtlasTask, args?: string[]): Promise<void>;
  spawn(project: AtlasProject, task: AtlasTask, args?: string[]): ChildProcess;
  formatGenerated(projectRoot: string): Promise<boolean>;
  installDependencies(projectRoot: string): Promise<void>;
  missingScaffoldDependency(framework: "angular" | "react"): Promise<string | undefined>;
  installScaffoldDependency(framework: "angular" | "react"): Promise<void>;
  scaffoldProject(options: AtlasScaffoldOptions): Promise<boolean>;
  generationRoot(type: "host" | "app", name: string): string;
}

export interface AtlasScaffoldOptions {
  type: "host" | "app";
  name: string;
  framework: "angular" | "react";
  projectRoot: string;
  interactive: boolean;
  routing: boolean;
}

export async function detectWorkspace(start = process.cwd()): Promise<AtlasWorkspace> {
  const resolvedStart = resolve(start);
  const root = await findWorkspaceRoot(resolvedStart);
  const kind = await workspaceKind(root);
  const packageManager = await detectPackageManager(root);
  const generationBase = await detectGenerationBase(root, resolvedStart);
  return {
    kind,
    root,
    packageManager,
    findProject: (name) => findAtlasProject(root, name, resolvedStart),
    run: (project, task, args = []) => runProcess(createTaskCommand(kind, packageManager, root, project, task, args)),
    spawn: (project, task, args = []) => spawnProcess(createTaskCommand(kind, packageManager, root, project, task, args)),
    formatGenerated: async (projectRoot) => {
      const command = await createFormatGeneratedCommand(kind, packageManager, root, projectRoot);
      if (!command) return false;
      await runProcess(command);
      return true;
    },
    installDependencies: async (projectRoot) => runProcess(createInstallCommand(
      packageManager,
      root,
      await installationRoot(kind, root, projectRoot)
    )),
    missingScaffoldDependency: async (framework) => {
      if (kind !== "nx") return undefined;
      const plugin = nxFrameworkPlugin(framework);
      return await packageIsInstalled(root, plugin) ? undefined : plugin;
    },
    installScaffoldDependency: async (framework) => {
      if (kind === "nx") await runProcess(createNxPluginInstallCommand(packageManager, root, framework));
    },
    scaffoldProject: async (options) => {
      if (kind !== "nx") return false;
      const directory = relative(root, options.projectRoot);
      if (!directory || directory === ".." || directory.startsWith("../")) {
        throw new Error("Nx projects must be generated inside the workspace root.");
      }
      try {
        await runProcess(createNxGenerationCommand(packageManager, root, {
          framework: options.framework,
          directory,
          interactive: options.interactive,
          routing: options.routing
        }));
      } catch (error) {
        const plugin = options.framework === "angular" ? "@nx/angular" : "@nx/react";
        throw new Error(`Nx could not scaffold "${options.name}". Install ${plugin} in the workspace and try again.`, { cause: error });
      }
      return true;
    },
    generationRoot: (_type, name) => join(root, generationBase, name)
  };
}

export function createNxGenerationCommand(
  manager: AtlasPackageManager,
  root: string,
  options: { framework: "angular" | "react"; directory: string; interactive: boolean; routing: boolean }
): ProcessCommand {
  const generator = options.framework === "angular" ? "@nx/angular:application" : "@nx/react:application";
  const args = [
    "nx", "generate", generator, options.directory,
    `--interactive=${options.interactive}`, "--skipFormat", `--routing=${options.routing}`,
    ...(!options.interactive ? [
      "--e2eTestRunner=none", "--unitTestRunner=none",
      ...(options.framework === "react" ? ["--bundler=vite"] : ["--bundler=esbuild"])
    ] : [])
  ];
  return packageExecutor(manager, root, args);
}

export function createNxPluginInstallCommand(
  manager: AtlasPackageManager,
  root: string,
  framework: "angular" | "react"
): ProcessCommand {
  return packageExecutor(manager, root, [
    "nx", "add", nxFrameworkPlugin(framework), "--interactive=false"
  ]);
}

export function createInstallCommand(
  manager: AtlasPackageManager,
  _workspaceRoot: string,
  projectRoot: string
): ProcessCommand {
  // npm discovers the applicable project/workspace .npmrc itself. Passing the
  // same file as --globalconfig makes npm load it twice and abort.
  return { command: manager, args: ["install"], cwd: projectRoot };
}

export async function createFormatGeneratedCommand(
  kind: AtlasWorkspaceKind,
  manager: AtlasPackageManager,
  workspaceRoot: string,
  projectRoot: string
): Promise<ProcessCommand | undefined> {
  if (kind === "nx") {
    if (!await nxFormatterAvailable(workspaceRoot)) return undefined;
    const target = relative(workspaceRoot, projectRoot) || ".";
    return quietCommand(packageExecutor(manager, workspaceRoot, ["nx", "format:write", target]));
  }

  const projectScripts = await packageScripts(projectRoot);
  if ("format" in projectScripts) return quietCommand(packageScript(manager, projectRoot, "format", []));
  if ("lint" in projectScripts) return quietCommand(packageScript(manager, projectRoot, "lint", ["--fix"]));

  const target = relative(workspaceRoot, projectRoot) || ".";
  const workspaceScripts = await packageScripts(workspaceRoot);
  if ("format" in workspaceScripts) return quietCommand(packageScript(manager, workspaceRoot, "format", [target]));
  if ("lint" in workspaceScripts) return quietCommand(packageScript(manager, workspaceRoot, "lint", ["--fix", target]));

  return undefined;
}

export async function installationRoot(kind: AtlasWorkspaceKind, workspaceRoot: string, projectRoot: string): Promise<string> {
  if (kind !== "nx") return projectRoot;
  const projectPackage = join(projectRoot, "package.json");
  return await exists(projectPackage) ? projectRoot : workspaceRoot;
}

async function findWorkspaceRoot(start: string): Promise<string> {
  let current = start;
  while (true) {
    if (await hasAny(current, ["nx.json", "turbo.json", "pnpm-workspace.yaml", "pnpm-lock.yaml", "yarn.lock", "package-lock.json"]) || await declaresWorkspaces(current)) return current;
    const parent = dirname(current);
    if (parent === current) return start;
    current = parent;
  }
}

async function workspaceKind(root: string): Promise<AtlasWorkspaceKind> {
  if (await exists(join(root, "nx.json"))) return "nx";
  if (await exists(join(root, "turbo.json"))) return "turbo";
  const packageJson = await readJson<{ workspaces?: unknown }>(join(root, "package.json"));
  return packageJson?.workspaces || await exists(join(root, "pnpm-workspace.yaml")) ? "workspace" : "standalone";
}

async function detectPackageManager(root: string): Promise<AtlasPackageManager> {
  const packageJson = await readJson<{ packageManager?: string }>(join(root, "package.json"));
  const declared = packageJson?.packageManager?.split("@")[0];
  if (declared === "yarn" || declared === "pnpm" || declared === "npm") return declared;
  if (await exists(join(root, "pnpm-lock.yaml"))) return "pnpm";
  if (await exists(join(root, "yarn.lock"))) return "yarn";
  return "npm";
}

async function findAtlasProject(root: string, name: string, currentDirectory = process.cwd()): Promise<AtlasProject> {
  const requestedName = name === "." ? currentDirectory : name;
  const directCandidates = [resolve(root, name), resolve(currentDirectory, name), currentDirectory];
  for (const candidate of directCandidates) {
    const project = await readProject(candidate, requestedName, root);
    if (project) return project;
  }
  const matches = await discoverProjects(root, name, root, 0);
  if (matches.length === 1) return matches[0]!;
  if (matches.length > 1) throw new Error(`Atlas found multiple projects named "${name}". Pass the project directory instead.`);
  throw new Error(`Could not find Atlas project "${name}" from workspace ${root}.`);
}

async function discoverProjects(directory: string, name: string, workspaceRoot: string, depth: number): Promise<AtlasProject[]> {
  if (depth > 5) return [];
  const project = await readProject(directory, name, workspaceRoot);
  if (project) return [project];
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); } catch { return []; }
  const ignored = new Set(["node_modules", ".git", "dist", ".atlas", ".nx", ".turbo", "coverage"]);
  const nested = await Promise.all(entries
    .filter((entry) => entry.isDirectory() && !ignored.has(entry.name) && !entry.name.startsWith("."))
    .map((entry) => discoverProjects(join(directory, entry.name), name, workspaceRoot, depth + 1)));
  return nested.flat();
}

async function readProject(root: string, requestedName: string, workspaceRoot: string): Promise<AtlasProject | undefined> {
  if (!await exists(join(root, "atlas.config.ts"))) return undefined;
  const packageJson = await readJson<{ name?: string; version?: string }>(join(root, "package.json"));
  const nxProject = await readJson<NxProjectConfiguration>(join(root, "project.json"));
  const packageName = packageJson?.name ?? nxProject?.name;
  if (!packageName || (!packageJson?.version && !nxProject)) return undefined;
  const identifiers = [packageName, packageName.split("/").at(-1), nxProject?.name, root.split("/").at(-1)];
  if (!identifiers.includes(requestedName) && resolve(requestedName) !== root) return undefined;
  return {
    id: nxProject?.name ?? packageName,
    root,
    packageName,
    version: packageJson?.version ?? "0.0.0",
    outputPaths: nxOutputPaths(nxProject, workspaceRoot, relative(workspaceRoot, root))
  };
}

interface NxProjectConfiguration {
  name?: string;
  targets?: Record<string, NxTargetConfiguration>;
}

interface NxTargetConfiguration {
  defaultConfiguration?: string;
  outputs?: string[];
  executor?: string;
  options?: { outputPath?: NxOutputPath; target?: string };
  configurations?: Record<string, { outputPath?: NxOutputPath }>;
}

type NxOutputPath = string | { base?: string; browser?: string };

function nxOutputPaths(project: NxProjectConfiguration | undefined, workspaceRoot: string, projectRoot: string): string[] {
  const build = project?.targets?.build;
  if (!build) return [];
  const targets = nxOutputTargets(project, build);
  const configuredOutputPaths = targets.flatMap(({ target, configuration }) => configuredNxOutputPaths(target, configuration, workspaceRoot));
  const declaredOutputs = targets.flatMap(({ target }) => declaredNxOutputPaths(target, {
    projectName: project?.name,
    projectRoot,
    workspaceRoot
  }));
  return [...new Set([
    ...configuredOutputPaths,
    ...declaredOutputs
  ])];
}

function nxOutputTargets(
  project: NxProjectConfiguration | undefined,
  build: NxTargetConfiguration
): Array<{ target: NxTargetConfiguration; configuration?: string }> {
  const delegated = delegatedNxBuildTarget(project, build);
  return delegated ? [delegated, { target: build }] : [{ target: build }];
}

function delegatedNxBuildTarget(
  project: NxProjectConfiguration | undefined,
  build: NxTargetConfiguration
): { target: NxTargetConfiguration; configuration?: string } | undefined {
  if (build.executor !== "@angular-architects/native-federation:build") return undefined;
  const target = build.options?.target;
  if (!target) return undefined;
  const [projectName, targetName, configuration] = target.split(":");
  if (projectName !== project?.name || !targetName) return undefined;
  const delegatedTarget = project.targets?.[targetName];
  return delegatedTarget ? { target: delegatedTarget, configuration } : undefined;
}

function configuredNxOutputPaths(target: NxTargetConfiguration, configuration: string | undefined, workspaceRoot: string): string[] {
  const configurations = Object.entries(target.configurations ?? {});
  const preferredConfiguration = configuration ?? target.defaultConfiguration;
  const orderedConfigurations = preferredConfiguration
    ? configurations.sort(([left], [right]) => Number(right === preferredConfiguration) - Number(left === preferredConfiguration))
    : configurations;
  return [
    ...expandOutputPath(target.options?.outputPath, workspaceRoot),
    ...orderedConfigurations.flatMap(([, targetConfiguration]) => expandOutputPath(targetConfiguration.outputPath, workspaceRoot))
  ];
}

function declaredNxOutputPaths(target: NxTargetConfiguration, context: {
  projectName: string | undefined;
  projectRoot: string;
  workspaceRoot: string;
}): string[] {
  return (target.outputs ?? [])
    .map((output) => interpolateNxOutput(output, context.projectName, context.projectRoot))
    .filter((output): output is string => Boolean(output))
    .map((output) => resolve(context.workspaceRoot, output));
}

function expandOutputPath(outputPath: NxOutputPath | undefined, workspaceRoot: string): string[] {
  if (typeof outputPath === "string") return [resolve(workspaceRoot, outputPath)];
  if (!outputPath?.base) return [];
  const base = resolve(workspaceRoot, outputPath.base);
  return outputPath.browser ? [resolve(base, outputPath.browser), base] : [base];
}

function interpolateNxOutput(output: string, projectName: string | undefined, projectRoot: string): string | undefined {
  if (output.includes("{options.outputPath}")) return undefined;
  return output
    .replace(/^\{workspaceRoot\}\/?/, "")
    .replaceAll("{projectName}", projectName ?? "")
    .replace(/^\{projectRoot\}\/?/, projectRoot ? `${projectRoot}/` : "");
}

export function createTaskCommand(kind: AtlasWorkspaceKind, manager: AtlasPackageManager, root: string, project: AtlasProject, task: AtlasTask, args: string[] = []): ProcessCommand {
  if (kind === "nx") return packageExecutor(manager, root, ["nx", "run", `${project.id}:${task}`, ...args]);
  if (kind === "turbo" && task !== "atlas:config") return turboTask(manager, root, project, task, args);
  if (kind === "workspace" || kind === "turbo") return workspaceTask(manager, root, project, task, args);
  return { command: manager, args: ["run", task, ...(args.length ? ["--", ...args] : [])], cwd: project.root };
}

function workspaceTask(manager: AtlasPackageManager, root: string, project: AtlasProject, task: AtlasTask, args: string[]): ProcessCommand {
  if (manager === "yarn") return { command: "yarn", args: ["workspace", project.packageName, "run", task, ...args], cwd: root };
  if (manager === "pnpm") return { command: "pnpm", args: ["--filter", project.packageName, "run", task, ...args], cwd: root };
  return { command: "npm", args: ["run", task, "--workspace", project.packageName, ...(args.length ? ["--", ...args] : [])], cwd: root };
}

function turboTask(manager: AtlasPackageManager, root: string, project: AtlasProject, task: AtlasTask, args: string[]): ProcessCommand {
  const turboArgs = ["turbo", "run", task, `--filter=${project.packageName}`, ...(args.length ? ["--", ...args] : [])];
  if (manager === "yarn") return { command: "yarn", args: ["exec", "--", ...turboArgs], cwd: root };
  return packageExecutor(manager, root, turboArgs);
}

function packageExecutor(manager: AtlasPackageManager, root: string, args: string[]): ProcessCommand {
  if (manager === "yarn") return { command: "yarn", args, cwd: root };
  if (manager === "pnpm") return { command: "pnpm", args: ["exec", ...args], cwd: root };
  return { command: "npx", args, cwd: root };
}

function packageScript(manager: AtlasPackageManager, root: string, script: string, args: string[]): ProcessCommand {
  if (manager === "yarn") return { command: "yarn", args: ["run", script, ...args], cwd: root };
  if (manager === "pnpm") return { command: "pnpm", args: ["run", script, ...(args.length ? ["--", ...args] : [])], cwd: root };
  return { command: "npm", args: ["run", script, ...(args.length ? ["--", ...args] : [])], cwd: root };
}

function quietCommand(command: ProcessCommand): ProcessCommand {
  return { ...command, stdio: ["ignore", "ignore", "inherit"] };
}

async function packageScripts(root: string): Promise<Record<string, unknown>> {
  const packageJson = await readJson<{ scripts?: Record<string, unknown> }>(join(root, "package.json"));
  return packageJson?.scripts ?? {};
}

async function detectGenerationBase(root: string, start: string): Promise<string> {
  const startDirectory = relative(root, start);
  if (startDirectory && dirname(startDirectory) === ".") return startDirectory;

  const patterns = await workspacePatterns(root);
  const conventional = patterns.find((pattern) => pattern === "apps/*" || pattern.startsWith("apps/"));
  const selected = conventional ?? patterns.find((pattern) => pattern.includes("*"));
  if (selected) return selected.slice(0, selected.indexOf("*")).replace(/\/$/, "") || ".";
  return "apps";
}

async function workspacePatterns(root: string): Promise<string[]> {
  const packageJson = await readJson<{ workspaces?: string[] | { packages?: string[] } }>(join(root, "package.json"));
  const declared = Array.isArray(packageJson?.workspaces)
    ? packageJson.workspaces
    : packageJson?.workspaces?.packages ?? [];
  if (declared.length) return declared;
  try {
    const source = await readFile(join(root, "pnpm-workspace.yaml"), "utf8");
    return [...source.matchAll(/^\s*-\s*['"]?([^'"#\n]+?)['"]?\s*$/gm)].map((match) => match[1]!.trim());
  } catch {
    return [];
  }
}

function nxFrameworkPlugin(framework: "angular" | "react"): string {
  return framework === "angular" ? "@nx/angular" : "@nx/react";
}

async function nxFormatterAvailable(root: string): Promise<boolean> {
  for (const packageName of ["nx", "@nx/workspace", "@nx/angular", "@nx/react"]) {
    if (await packageIsInstalled(root, packageName)) return true;
  }
  return false;
}

async function packageIsInstalled(root: string, packageName: string): Promise<boolean> {
  if (await exists(join(root, "node_modules", ...packageName.split("/"), "package.json"))) return true;
  const packageJson = await readJson<Record<string, unknown>>(join(root, "package.json"));
  return ["dependencies", "devDependencies", "optionalDependencies"]
    .some((field) => packageName in asDependencyMap(packageJson?.[field]));
}

function asDependencyMap(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

async function hasAny(root: string, names: string[]): Promise<boolean> {
  return (await Promise.all(names.map((name) => exists(join(root, name))))).some(Boolean);
}

async function declaresWorkspaces(root: string): Promise<boolean> {
  const packageJson = await readJson<{ workspaces?: unknown }>(join(root, "package.json"));
  return packageJson?.workspaces !== undefined;
}

async function exists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

async function readJson<T>(path: string): Promise<T | undefined> {
  try { return JSON.parse(await readFile(path, "utf8")) as T; } catch { return undefined; }
}
