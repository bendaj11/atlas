import { CliArguments, type SupportedFramework } from "./arguments.js";
import type { AtlasPrompter } from "./ui.js";

export interface AtlasInvocation {
  command?: string;
  subcommand?: string;
  name?: string;
  framework?: SupportedFramework;
  version?: string;
}

export async function resolveInvocation(args: CliArguments, prompts: AtlasPrompter): Promise<AtlasInvocation> {
  let command = args.command;
  let subcommand = args.subcommand;
  let name = args.name;
  let framework = args.flag("framework") ? args.framework() : undefined;
  let version = args.flag("version");
  if (!prompts.interactive) return { command, subcommand, name, framework, version };

  if (command === "g" || command === "generate") {
    subcommand ??= await prompts.select("What would you like to generate?", [
      { label: "App app", value: "app" },
      { label: "Host application", value: "host" },
      { label: "Exported widget", value: "widget" },
      { label: "Publication adapter config", value: "publish-config" }
    ]);
    if (subcommand !== "publish-config") name ??= await prompts.input(subcommand === "widget" ? "Widget name" : `${title(subcommand)} name`);
    if ((subcommand === "host" || subcommand === "app") && !framework) {
      framework = await prompts.select<SupportedFramework>("Framework", [
        { label: "React", value: "react" },
        { label: "Angular", value: "angular" },
      ]);
    }
  } else if ((command === "build" || command === "build-bootstrap" || command === "release") && !subcommand) {
    subcommand = await prompts.input("Atlas project name or directory");
  } else if (command === "rollback" && !subcommand) {
    subcommand = await prompts.input("Stable host or app ID from atlas.config.ts");
  }
  if (command === "rollback" && !version) version = await prompts.input("Production version to restore");
  return { command, subcommand, name, framework, version };
}

function title(value: string): string { return value.charAt(0).toUpperCase() + value.slice(1); }
