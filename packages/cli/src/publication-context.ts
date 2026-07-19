import { execFileSync } from "node:child_process";
import type { CliArguments } from "./arguments.js";
import {
  inferredDefaultBranch,
  inferredGitBranch,
  inferredGitTag,
  inferredPullRequestNumber,
  publicationRequired
} from "./ci-metadata.js";

export interface AtlasPublicationContext {
  publish: boolean;
  reason?: string;
}

export function resolvePublicationContext(args: CliArguments, workspaceRoot: string): AtlasPublicationContext {
  if (args.flag("pr-number") ?? inferredPullRequestNumber()) return { publish: true };
  if (inferredGitTag()) return { publish: true };

  const branch = args.flag("git-branch") ?? inferredGitBranch() ?? currentGitBranch(workspaceRoot);
  if (!branch) return { publish: true };
  const defaultBranch = args.flag("default-branch") ?? inferredDefaultBranch();
  if (branch === defaultBranch || (!defaultBranch && (branch === "main" || branch === "master"))) {
    return { publish: true };
  }

  const reason = `branch "${branch}" has no pull request number and is not the production branch or tag`;
  if (args.hasFlag("require-publication") || publicationRequired()) {
    throw new Error(`Atlas expected a publication, but ${reason}.`);
  }
  return { publish: false, reason };
}

function currentGitBranch(root: string): string | undefined {
  try {
    return execFileSync("git", ["branch", "--show-current"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim() || undefined;
  } catch {
    return undefined;
  }
}
