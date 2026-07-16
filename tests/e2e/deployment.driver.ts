import { spawn } from "node:child_process";

export function runCli(workspaceRoot: string, args: string[], environment: NodeJS.ProcessEnv = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: workspaceRoot,
      env: { ...process.env, ...environment },
      stdio: "inherit"
    });
    child.once("error", reject);
    child.once("exit", (code) => code === 0
      ? resolve()
      : reject(new Error(`Atlas CLI exited with code ${code ?? "unknown"}.`)));
  });
}

export interface DeploymentCatalog {
  host: { id: string; remoteEntryUrl: string; version?: string };
  apps: Array<{ id: string; remoteEntryUrl: string; version?: string }>;
}

export function deploymentCatalog(value: unknown): DeploymentCatalog {
  if (!isDeploymentCatalog(value)) {
    throw new Error("Deployment catalog has an invalid shape.");
  }
  return value;
}

function isDeploymentCatalog(value: unknown): value is DeploymentCatalog {
  return isRecord(value) && isManifest(value.host) && Array.isArray(value.apps) && value.apps.every(isManifest);
}

function isManifest(value: unknown): value is { id: string; remoteEntryUrl: string; version?: string } {
  return isRecord(value) && typeof value.id === "string" && typeof value.remoteEntryUrl === "string"
    && (value.version === undefined || typeof value.version === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
