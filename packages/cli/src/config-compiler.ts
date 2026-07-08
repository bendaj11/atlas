import { join } from "node:path";
import { runProcess, type ProcessCommand } from "./process.js";
import type { AtlasPackageManager, AtlasProject, AtlasWorkspace } from "./workspace.js";

export async function compileAtlasConfig(workspace: AtlasWorkspace, project: AtlasProject): Promise<void> {
  try {
    await workspace.run(project, "atlas:config");
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
