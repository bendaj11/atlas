import { readFile } from "node:fs/promises";
import { ChildProcess } from "node:child_process";
import type { AtlasProject, AtlasWorkspace } from "../dist/workspace.js";

const defaultProject: AtlasProject = {
  id: "test-project",
  root: "/workspace/test-project",
  packageName: "test-project",
  version: "1.0.0",
  outputPaths: []
};

export function createTestWorkspace(overrides: Partial<AtlasWorkspace> = {}): AtlasWorkspace {
  return {
    kind: "standalone",
    root: "/workspace",
    packageManager: "npm",
    async findProject() { return defaultProject; },
    async run() {},
    spawn() { throw new Error("Workspace spawn was not expected."); },
    async formatGenerated() { return false; },
    async installDependencies() {},
    async missingScaffoldDependency() { return undefined; },
    async installScaffoldDependency() {},
    async scaffoldProject() { return false; },
    generationRoot(_type, name) { return `/workspace/${name}`; },
    ...overrides
  };
}

export class TestChildProcess extends ChildProcess {
  override kill(signal: NodeJS.Signals | number = "SIGTERM"): boolean {
    const signalCode = typeof signal === "string" ? signal : "SIGTERM";
    this.emit("exit", null, signalCode);
    return true;
  }

  finish(exitCode = 0): void {
    this.emit("exit", exitCode, null);
  }
}

export async function atlasPackageRange(): Promise<string> {
  const packageJson = JSON.parse(await readFile(new URL("../../generators/package.json", import.meta.url), "utf8"));
  return `^${packageJson.version}`;
}
