import { join } from "node:path";
import { readJsonFile, writeJsonFile } from "./generate-json.js";

type ProjectType = "host" | "app";
type RunnerKey = "builder" | "executor";

export async function ensureAngularWorkspaceFederationConfig(
  root: string,
  projectName: string,
  type: ProjectType
): Promise<void> {
  const workspaceFile = join(root, "angular.json");
  const workspace = await readJsonFile<Record<string, unknown>>(workspaceFile);
  if (!workspace) return;
  const project = asObject(asObject(workspace.projects)[projectName]);
  const targets = asObject(project.architect);
  if (!Object.keys(targets).length) return;
  ensureAngularNativeFederationTargets(targets, projectName, type, "builder");
  project.architect = targets;
  asObject(workspace.projects)[projectName] = project;
  await writeJsonFile(workspaceFile, workspace);
}

export function ensureAngularNativeFederationTargets(
  targets: Record<string, unknown>,
  projectName: string,
  type: ProjectType,
  runnerKey: RunnerKey
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

function isNativeFederationTarget(value: unknown, runnerKey: RunnerKey): boolean {
  return asObject(value)[runnerKey] === "@angular-architects/native-federation:build";
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
