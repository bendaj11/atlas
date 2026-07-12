import { readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import type { SupportedFramework } from "./arguments.js";
import { ensureAngularNativeFederationTargets } from "./generate-angular.js";
import { addUniqueString } from "./generate-files.js";
import { readJsonFile, writeJsonFile } from "./generate-json.js";
import { exists } from "./generate-paths.js";

type ProjectType = "host" | "app";
type PackageManager = "yarn" | "pnpm" | "npm";

export function nxTarget(packageManager: PackageManager, cwd: string, script: string): Record<string, unknown> {
  return { executor: "nx:run-commands", options: { cwd, command: `${packageManager} run ${script}` } };
}

export function atlasConfigNxTarget(packageManager: PackageManager, cwd: string): Record<string, unknown> {
  return { ...nxTarget(packageManager, cwd, "atlas:config"), outputs: ["{projectRoot}/.atlas"] };
}

export async function alignDelegatedTsconfig(root: string, framework: SupportedFramework): Promise<void> {
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
    if (Array.isArray(tsconfig.files)) {
      tsconfig.files = addUniqueString(tsconfig.files, "atlas.config.ts");
    } else {
      tsconfig.include = addUniqueString(Array.isArray(tsconfig.include) ? tsconfig.include : [], "atlas.config.ts");
    }
    await writeJsonFile(target, tsconfig);
    return;
  }

  compilerOptions.module = "ESNext";
  compilerOptions.moduleResolution = "bundler";
  compilerOptions.types = addUniqueString(Array.isArray(compilerOptions.types) ? compilerOptions.types : [], "vite/client");
  tsconfig.compilerOptions = compilerOptions;
  if (Array.isArray(tsconfig.files)) {
    tsconfig.files = addUniqueString(tsconfig.files, "atlas.config.ts");
  } else {
    tsconfig.include = addUniqueString(Array.isArray(tsconfig.include) ? tsconfig.include : [], "atlas.config.ts");
  }
  await writeJsonFile(target, tsconfig);
}

export async function alignDelegatedAngularFederationConfig(workspaceRoot: string, root: string): Promise<void> {
  const projectRoot = normalizedProjectRoot(workspaceRoot, root);
  if (projectRoot === ".") return;

  const configPath = join(root, "federation.config.js");
  if (!await exists(configPath)) return;

  const source = await readFile(configPath, "utf8");
  const escapedProjectRoot = escapeRegExp(projectRoot);
  const next = source
    .replace(
      new RegExp(`(["'\`])\\./(?:${escapedProjectRoot}/)?src/entry\\.ts\\1`, "g"),
      `join(__dirname, "src/entry.ts")`
    )
    .replace(
      new RegExp(`\`\\./(?:${escapedProjectRoot}/)?src/exported-widgets/\\$\\{entry\\.name\\}/index\\.ts\``, "g"),
      `join(__dirname, "src/exported-widgets", entry.name, "index.ts")`
    );

  if (next !== source) await writeFile(configPath, next, "utf8");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function ensureDelegatedNxTargets(
  workspaceRoot: string,
  root: string,
  name: string,
  type: ProjectType,
  framework: SupportedFramework,
  devServerPort?: number
): Promise<void> {
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
  if (framework === "angular") ensureAngularNativeFederationTargets(targets, projectName, type, "executor", devServerPort);
  ensureAtlasConfigTarget(targets, projectName);
  ensureDevTarget(targets, projectName, type);
  project.targets = targets;
  await writeJsonFile(projectFile, project);
}

function ensureAtlasConfigTarget(targets: Record<string, unknown>, projectName: string): void {
  const atlasConfigTarget = {
    executor: "nx:run-commands",
    outputs: ["{projectRoot}/.atlas"],
    options: { command: `atlas compile-config ${projectName}` }
  };
  if (!targets["atlas:config"] || isOutdatedAtlasConfigTarget(targets["atlas:config"])) {
    targets["atlas:config"] = atlasConfigTarget;
  }
}

function ensureDevTarget(targets: Record<string, unknown>, projectName: string, type: ProjectType): void {
  if (type === "app" && (!targets.dev || isOutdatedAppDevTarget(targets.dev, projectName))) {
    targets.dev = {
      executor: "nx:run-commands",
      options: { command: `atlas dev ${projectName}`, forwardAllArgs: true }
    };
  }
  if (type === "host" && !isAtlasHostDevTarget(targets.dev, projectName)) {
    preserveNativeHostDevTarget(targets);
    if (!targets.serve) return;
    targets.dev = {
      executor: "nx:run-commands",
      options: {
        commands: [
          { command: `atlas runtime-config ${projectName}` },
          { command: `nx run ${projectName}:serve`, forwardAllArgs: true }
        ],
        parallel: false
      }
    };
  }
  if (targets.dev && !targets[projectName]) {
    targets[projectName] = {
      executor: "nx:run-commands",
      options: { command: `nx run ${projectName}:dev`, forwardAllArgs: true }
    };
  }
}

function preserveNativeHostDevTarget(targets: Record<string, unknown>): void {
  if (!targets.serve && targets.dev) targets.serve = targets.dev;
}

function isAtlasHostDevTarget(value: unknown, projectName: string): boolean {
  const options = asObject(asObject(value).options);
  if (!Array.isArray(options.commands)) return false;
  return options.commands.some((command) =>
    asObject(command).command === `atlas runtime-config ${projectName}`
  );
}

function isOutdatedAppDevTarget(value: unknown, projectName: string): boolean {
  const target = asObject(value);
  const options = asObject(target.options);
  return options.command === `nx run ${projectName}:serve`;
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
