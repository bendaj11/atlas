#!/usr/bin/env node
import { realpathSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ensureActionableError } from "@atlas/schema";
import { CliArguments } from "./arguments.js";
import { AtlasBuildService } from "./build.js";
import { AtlasBootstrapService } from "./bootstrap.js";
import { compileAtlasConfig } from "./config-compiler.js";
import { AtlasDevService } from "./dev.js";
import { AtlasGenerateService } from "./generate.js";
import { loadEnvFiles } from "./env.js";
import { formatHelp, requestedHelpTopic } from "./help.js";
import { AtlasPublishService, loadAtlasPublishConfig } from "./publish.js";
import { resolvePublicationContext } from "./publication-context.js";
import { readOpenPullRequests } from "./pr-state-file.js";
export { defineAtlasPublishConfig, S3PublicationStorage } from "./publish.js";
export type {
  AtlasPublicationLease,
  AtlasPublicationObjectMetadata,
  AtlasPublicationStorage,
  AtlasPublishConfig,
  AtlasPullRequestLookup,
  AtlasPullRequestResolver,
  AtlasPullRequestStatus,
  S3Options
} from "./publish.js";
import { AtlasVerifyService, type AtlasVerificationCheck } from "./verify.js";
import { resolveInvocation } from "./interaction.js";
import { TerminalPrompter, ui, type AtlasPrompter } from "./ui.js";
import { detectWorkspace } from "./workspace.js";

export async function runAtlasCli(values = process.argv.slice(2), prompts: AtlasPrompter = new TerminalPrompter()): Promise<void> {
  const args = new CliArguments(values);
  try {
    if (["--version", "-v", "version"].includes(values[0] ?? "") && values.length === 1) {
      console.info(cliVersion());
      return;
    }
    const helpTopic = requestedHelpTopic(values);
    if (helpTopic) {
      console.info(formatHelp(helpTopic));
      return;
    }
    const invocation = await resolveInvocation(args, prompts);
    const workspace = await detectWorkspace();
    if (invocation.command !== "dev") await loadEnvFiles(workspace.root);
    const builds = new AtlasBuildService(workspace, args);
    const generate = new AtlasGenerateService(workspace, args, prompts);

    if (invocation.command === "build-bootstrap" && invocation.subcommand) {
      ui.heading(`Building bootstrap for ${invocation.subcommand}`);
      const result = await new AtlasBootstrapService(workspace, args, builds).build(invocation.subcommand);
      ui.success(`Built static bootstrap in ${result.directory}.`);
      ui.info(`Bootstrap digest: ${result.digest}`);
      ui.info(`Deploy ${result.files.join(", ")} with Nginx or equivalent static hosting.`);
      return;
    }

    if (invocation.command === "g" || invocation.command === "generate") {
      if (!invocation.name) {
        console.info(formatHelp(["generate"]));
        return;
      }
      if (invocation.subcommand === "host" || invocation.subcommand === "app") {
        ui.heading(`Creating Atlas ${invocation.subcommand}`);
        const roots = await generate.project(invocation.subcommand, invocation.name, invocation.framework, async (projectRoots) => {
          if (args.hasFlag("skip-install")) return;
          ui.info(`Installing dependencies with ${workspace.packageManager}...`);
          await generate.installDependencies(projectRoots);
        });
        ui.success(`Created "${invocation.name}" at ${roots.join(" and ")}.`);
        return;
      }
      if (invocation.subcommand === "widget") {
        ui.heading("Creating Atlas widget");
        await generate.widget(invocation.name, args.flag("app") ?? ".");
        ui.success(`Created widget "${invocation.name}".`);
        return;
      }
    }

    if (invocation.command === "build" && invocation.subcommand) {
      ui.heading(`Building ${invocation.subcommand}`);
      const result = await builds.build(invocation.subcommand);
      if (result.artifact === "host") {
        ui.success(`Built host client ${result.manifest.id}@${result.manifest.version}.`);
        ui.info("Host bootstrap deploys independently through your platform target.");
      } else {
        ui.success(`Built app ${result.manifest.id}@${result.manifest.version}.`);
      }
      return;
    }

    if (invocation.command === "publish" && invocation.subcommand) {
      const publicationContext = resolvePublicationContext(args, workspace.root);
      if (!publicationContext.publish) {
        ui.info(`Atlas publication skipped: ${publicationContext.reason}.`);
        return;
      }
      ui.heading(`Publishing ${invocation.subcommand}`);
      const result = await publishAndVerify(args, builds, invocation.subcommand);
      if (result.skippedReason) {
        ui.info(`Atlas publication skipped: ${result.skippedReason}.`);
        return;
      }
      if (result.dryRun) result.uploaded.forEach((path) => ui.info(path));
      ui.success(result.dryRun ? `Dry run: ${result.uploaded.length} file(s).` : `Published ${result.uploaded.length} file(s).`);
      result.cleanupWarnings.forEach((warning) => ui.warning(warning));
      return;
    }

    if (invocation.command === "dev") {
      const project = invocation.subcommand && !invocation.subcommand.startsWith("-") ? invocation.subcommand : ".";
      ui.heading(`Starting ${project}`);
      await new AtlasDevService(workspace, args, builds).run(project, prompts);
      return;
    }

    if (invocation.command === "rollback" && invocation.subcommand) {
      ui.heading(`Rolling back ${invocation.subcommand}`);
      if (!invocation.version) throw new Error("Atlas rollback requires --version.");
      const result = await rollbackAndVerify(args, builds, invocation.subcommand, invocation.version);
      ui.success(`Selected ${invocation.subcommand}@${result.version} (${result.buildId}).`);
      ui.success(`Published rollback with ${result.uploaded.length} file(s).`);
      return;
    }

    if (invocation.command === "remove-pr") {
      const prNumber = positiveInteger(args.flag("pr-number"), "--pr-number");
      const artifactIds = await configuredArtifactIds(args, workspace, builds);
      const config = await loadAtlasPublishConfig(args);
      ui.heading(`Removing Atlas builds for pull request #${prNumber}`);
      const result = await new AtlasPublishService(args, builds).removePr(artifactIds, prNumber, {
        ...(config ? { config } : {})
      });
      if (result.removedBuilds === 0) ui.info(`No builds for pull request #${prNumber} matched this workspace.`);
      else ui.success(`Removed ${result.removedBuilds} build(s) for pull request #${prNumber}.`);
      result.cleanupWarnings.forEach((warning) => ui.warning(warning));
      return;
    }

    if (invocation.command === "prune-prs") {
      const artifactIds = await configuredArtifactIds(args, workspace, builds);
      const config = await loadAtlasPublishConfig(args);
      const stateFile = args.flag("state-file");
      const openPullRequests = stateFile ? await readOpenPullRequests(stateFile) : undefined;
      ui.heading("Reconciling Atlas pull-request builds");
      const result = await new AtlasPublishService(args, builds).prunePrs(artifactIds, openPullRequests, {
        ...(config ? { config } : {})
      });
      ui.success(`Checked ${result.checkedPullRequests} pull request(s); removed ${result.removedBuilds} closed build(s).`);
      result.cleanupWarnings.forEach((warning) => ui.warning(warning));
      return;
    }

    if (invocation.command === "compile-config") {
      const projectName = invocation.subcommand && !invocation.subcommand.startsWith("-") ? invocation.subcommand : ".";
      const project = await workspace.findProject(projectName);
      await compileAtlasConfig(workspace, project);
      ui.success(`Compiled ${project.id} atlas.config.ts.`);
      return;
    }

    if (invocation.command === "verify") {
      const runtimeUrls = configuredRuntimeUrls(args);
      if (!runtimeUrls.length) throw new Error("--runtime-url or ATLAS_RUNTIME_URLS is required.");
      ui.heading("Verifying Atlas deployment");
      await verifyRuntimeUrls(args, runtimeUrls);
      ui.success(`Verified ${runtimeUrls.length} deployment(s).`);
      return;
    }

    throw new Error(`Unknown or incomplete command "${values.join(" ")}". Run atlas --help for usage.`);
  } catch (error) {
    throw ensureActionableError(error, "Run atlas --help, correct command or input named above, then rerun command.");
  } finally {
    prompts.close();
  }
}

async function configuredArtifactIds(
  args: CliArguments,
  workspace: Awaited<ReturnType<typeof detectWorkspace>>,
  builds: AtlasBuildService
): Promise<string[]> {
  const explicit = splitUrls(args.flag("artifact-ids"));
  if (explicit.length) return explicit;
  const projects = await workspace.listProjects();
  if (projects.length === 0) throw new Error("Atlas found no configured projects in this workspace. Pass --artifact-ids explicitly.");
  return Promise.all(projects.map(async (project) => {
    if (!args.hasFlag("skip-compile")) await compileAtlasConfig(workspace, project);
    return (await builds.loadConfig(project.root)).id;
  }));
}

function positiveInteger(value: string | undefined, flag: string): number {
  const parsed = Number(value);
  if (!value || !Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${flag} must be a positive integer.`);
  }
  return parsed;
}

function cliVersion(): string {
  const packageJson = JSON.parse(readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8")) as { version?: string };
  if (!packageJson.version) throw new Error("Atlas CLI package version is missing.");
  return packageJson.version;
}

function printVerificationCheck(check: AtlasVerificationCheck): void {
  const message = `${check.subject}: ${check.message}`;
  if (check.status === "pass") ui.success(message);
  else if (check.status === "warning") ui.warning(message);
  else ui.error(message);
}

async function publishAndVerify(args: CliArguments, builds: AtlasBuildService, projectName: string) {
  const config = args.hasFlag("dry-run") ? undefined : await loadAtlasPublishConfig(args);
  const runtimeUrls = configuredRuntimeUrls(args, config?.runtimeUrls);
  return new AtlasPublishService(args, builds).run(projectName, {
    ...(config ? { config } : {}),
    ...(runtimeUrls.length ? {
      verify: async () => verifyRuntimeUrls(args, runtimeUrls)
    } : {})
  });
}

async function rollbackAndVerify(
  args: CliArguments,
  builds: AtlasBuildService,
  artifactId: string,
  version: string
) {
  const config = await loadAtlasPublishConfig(args);
  const runtimeUrls = configuredRuntimeUrls(args, config?.runtimeUrls);
  return new AtlasPublishService(args, builds).rollback(artifactId, version, {
    ...(config ? { config } : {}),
    ...(runtimeUrls.length ? { verify: async () => verifyRuntimeUrls(args, runtimeUrls) } : {})
  });
}

function configuredRuntimeUrls(args: CliArguments, configured: readonly string[] = []): string[] {
  const singleRuntimeUrl = args.flag("runtime-url") ?? process.env.ATLAS_RUNTIME_URL;
  return [...new Set([
    ...splitUrls(args.flag("runtime-urls") ?? process.env.ATLAS_RUNTIME_URLS),
    ...(singleRuntimeUrl ? [singleRuntimeUrl] : []),
    ...configured
  ])];
}

async function verifyRuntimeUrls(args: CliArguments, runtimeUrls: readonly string[]): Promise<void> {
  for (const runtimeUrl of runtimeUrls) {
    const report = await new AtlasVerifyService().run({ runtimeUrl, hostOrigin: args.flag("host-origin") });
    report.checks.forEach(printVerificationCheck);
    if (report.failures > 0) {
      throw new Error(`Deployment verification failed for ${runtimeUrl} with ${report.failures} failure(s).`);
    }
  }
}

function splitUrls(value: string | undefined): string[] {
  return value?.split(/[\s,]+/).filter(Boolean) ?? [];
}

if (isMainModule(import.meta.url, process.argv[1])) {
  runAtlasCli().catch((error: unknown) => {
    ui.error(ensureActionableError(error).message);
    process.exitCode = 1;
  });
}

function isMainModule(moduleUrl: string, executablePath?: string): boolean {
  if (!executablePath) return false;
  try {
    return realpathSync(fileURLToPath(moduleUrl)) === realpathSync(executablePath);
  } catch {
    return false;
  }
}
