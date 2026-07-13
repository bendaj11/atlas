#!/usr/bin/env node
import { realpathSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ensureActionableError } from "@atlas/schema";
import { CliArguments } from "./arguments.js";
import { AtlasBuildService } from "./build.js";
import { compileAtlasConfig } from "./config-compiler.js";
import { AtlasDevService } from "./dev.js";
import { AtlasGenerateService } from "./generate.js";
import { loadEnvFiles } from "./env.js";
import { formatHelp, requestedHelpTopic } from "./help.js";
import { AtlasRollbackService } from "./rollback.js";
import { AtlasPublishService, loadAtlasPublishConfig } from "./publish.js";
export { defineAtlasPublishConfig, FileSystemPublicationStorage, S3PublicationStorage } from "./publish.js";
export type { AtlasPublicationStorage, AtlasPublishConfig, S3Options } from "./publish.js";
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

    if (invocation.command === "g" || invocation.command === "generate") {
      if (invocation.subcommand === "publish-config") {
        ui.heading("Creating advanced Atlas publish config");
        const target = await generate.publishConfig();
        ui.success(`Created ${target}.`);
        return;
      }
      if (!invocation.name) {
        console.info(formatHelp(["generate"]));
        return;
      }
      if (invocation.subcommand === "host" || invocation.subcommand === "app") {
        ui.heading(`Creating Atlas ${invocation.subcommand}`);
        const root = await generate.project(invocation.subcommand, invocation.name, invocation.framework, async (projectRoot) => {
          if (args.hasFlag("skip-install")) return;
          ui.info(`Installing dependencies with ${workspace.packageManager}...`);
          await generate.installDependencies(projectRoot);
        });
        ui.success(`Created "${invocation.name}" at ${root}.`);
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
        ui.info("Publish dist/atlas-publication; host-server container does not contain client assets.");
      } else {
        ui.success(`Built app ${result.manifest.id}@${result.manifest.version}.`);
        ui.info("Upload dist/atlas-publication with your CI storage tooling.");
      }
      ui.info(`Publication plan: ${result.publicationPlan}`);
      return;
    }

    if (invocation.command === "publish") {
      const plan = args.flag("plan") ?? "dist/atlas-publication.json";
      ui.heading(`Publishing ${plan}`);
      const result = await publishAndVerify(args, plan);
      ui.success(result.dryRun ? `Dry run: ${result.uploaded.length} file(s).` : `Published ${result.uploaded.length} file(s).`);
      return;
    }

    if (invocation.command === "release" && invocation.subcommand) {
      ui.heading(`Releasing ${invocation.subcommand}`);
      const result = await builds.build(invocation.subcommand);
      const publication = await publishAndVerify(args, result.publicationPlan);
      ui.success(`Released ${result.manifest.kind} ${result.manifest.id}@${result.manifest.version}; ${publication.uploaded.length} file(s) published.`);
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
      const result = await new AtlasRollbackService(args).run(invocation.subcommand, invocation.version);
      ui.success(`Selected ${invocation.subcommand}@${result.version} (${result.buildId}).`);
      if (args.hasFlag("prepare-only")) ui.info(`Prepared rollback plan: ${result.plan}`);
      else {
        const publication = await publishAndVerify(args, result.plan);
        ui.success(`Published rollback with ${publication.uploaded.length} mutable file(s).`);
      }
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
      const runtimeUrl = args.flag("runtime-url");
      if (!runtimeUrl) throw new Error("--runtime-url is required.");
      ui.heading("Verifying Atlas deployment");
      const report = await new AtlasVerifyService().run({ runtimeUrl, hostOrigin: args.flag("host-origin") });
      report.checks.forEach(printVerificationCheck);
      if (report.failures > 0) throw new Error(`Verification failed with ${report.failures} failure(s) and ${report.warnings} warning(s).`);
      ui.success(`Deployment verified with ${report.warnings} warning(s).`);
      return;
    }

    throw new Error(`Unknown or incomplete command "${values.join(" ")}". Run atlas --help for usage.`);
  } catch (error) {
    throw ensureActionableError(error, "Run atlas --help, correct command or input named above, then rerun command.");
  } finally {
    prompts.close();
  }
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

async function publishAndVerify(args: CliArguments, plan: string) {
  const config = await loadAtlasPublishConfig(args);
  const singleRuntimeUrl = args.flag("runtime-url") ?? process.env.ATLAS_RUNTIME_URL;
  const runtimeUrls = [...new Set([
    ...splitUrls(args.flag("runtime-urls") ?? process.env.ATLAS_RUNTIME_URLS),
    ...(singleRuntimeUrl ? [singleRuntimeUrl] : []),
    ...(config?.runtimeUrls ?? [])
  ])];
  return new AtlasPublishService(args).run(plan, {
    ...(config ? { config } : {}),
    ...(runtimeUrls.length ? {
      verify: async () => {
        for (const runtimeUrl of runtimeUrls) {
          const report = await new AtlasVerifyService().run({ runtimeUrl, hostOrigin: args.flag("host-origin") });
          report.checks.forEach(printVerificationCheck);
          if (report.failures > 0) throw new Error(`Deployment verification failed for ${runtimeUrl} with ${report.failures} failure(s); previous mutable selections were restored.`);
        }
      }
    } : {})
  });
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
