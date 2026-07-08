import { access } from "node:fs/promises";
import { join } from "node:path";
import { runProcess, type ProcessCommand } from "./process.js";
import type { AtlasPackageManager, AtlasProject, AtlasWorkspace } from "./workspace.js";

export async function compileAtlasConfig(workspace: AtlasWorkspace, project: AtlasProject): Promise<void> {
  try {
    await workspace.run(project, "atlas:config");
    if (workspace.kind === "nx" && !await compiledAtlasConfigExists(project.root)) {
      await runProcess(createDirectAtlasConfigCommand(workspace.packageManager, project.root));
    }
  } catch (error) {
    if (workspace.kind !== "nx") throw error;
    await runProcess(createDirectAtlasConfigCommand(workspace.packageManager, project.root));
  }
}

function createDirectAtlasConfigCommand(manager: AtlasPackageManager, projectRoot: string): ProcessCommand {
  const args = ["tsc", "-p", join(projectRoot, "tsconfig.atlas.json")];
  if (manager === "yarn") return { command: "yarn", args, cwd: projectRoot };
  if (manager === "pnpm") return { command: "pnpm", args: ["exec", ...args], cwd: projectRoot };
  return { command: "npx", args, cwd: projectRoot };
}

async function compiledAtlasConfigExists(projectRoot: string): Promise<boolean> {
  for (const candidate of [
    join(projectRoot, ".atlas", "atlas.config.js"),
    join(projectRoot, "dist", "atlas.config.js"),
    join(projectRoot, "atlas.config.js")
  ]) {
    try {
      await access(candidate);
      return true;
    } catch { /* Try next compiler output location. */ }
  }
  return false;
}
