#!/usr/bin/env node
import { realpathSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CliArguments } from "./arguments.js";
import { AtlasBuildService } from "./build.js";
import { compileAtlasConfig } from "./config-compiler.js";
import { AtlasDevService } from "./dev.js";
import { AtlasGenerateService } from "./generate.js";
import { loadWorkspaceEnv } from "./env.js";
import { formatHelp, requestedHelpTopic } from "./help.js";
import { AtlasRollbackService } from "./rollback.js";
import { AtlasRuntimeConfigService } from "./runtime-config.js";
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
    await loadWorkspaceEnv(workspace.root);
    const builds = new AtlasBuildService(workspace, args);
    const generate = new AtlasGenerateService(workspace, args, prompts);

    if (invocation.command === "g" || invocation.command === "generate") {
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
      const manifest = await builds.build(invocation.subcommand);
      ui.success(`Built ${manifest.id}@${manifest.version}.`);
      ui.info("Upload dist/atlas-publication with your CI storage tooling.");
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
      ui.info(`Upload ${result.output} with your CI storage tooling.`);
      return;
    }

    if (invocation.command === "runtime-config" && invocation.subcommand) {
      ui.heading(`Generating runtime config for ${invocation.subcommand}`);
      const result = await new AtlasRuntimeConfigService(workspace, args, builds).generate(invocation.subcommand);
      ui.success(`Wrote ${result.path}.`);
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

if (isMainModule(import.meta.url, process.argv[1])) {
  runAtlasCli().catch((error: unknown) => {
    ui.error(error instanceof Error ? error.message : String(error));
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
