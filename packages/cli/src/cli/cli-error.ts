import { AtlasError, errorSummary } from "@atlas/schema";

const COMMAND_ALIASES: Readonly<Record<string, string>> = { g: "generate" };

export function createCliError(command: string | undefined, value: unknown): AtlasError {
  const normalizedCommand = command ? COMMAND_ALIASES[command] ?? command : undefined;
  const cause = value instanceof Error ? value : new Error(String(value));
  const sourceSummary = errorSummary(cause.message);
  return new AtlasError(cliSummary(normalizedCommand, sourceSummary), {
    suggestedActions: cliActions(normalizedCommand, sourceSummary),
    cause,
    code: "ATLAS_CLI_FAILURE",
    surface: "cli"
  });
}

function cliSummary(command: string | undefined, summary: string): string {
  if (/^(Atlas\b|--|ATLAS_|Unknown help topic|Unknown or incomplete command)/i.test(summary)) {
    return summary;
  }
  return command
    ? `Atlas ${command} failed: ${summary}`
    : `Atlas CLI failed: ${summary}`;
}

function cliActions(command: string | undefined, message: string): readonly string[] {
  if (/Unknown (?:help topic|or incomplete command)/i.test(message)) {
    return ["Run `atlas --help` to choose a supported command, then retry with the documented arguments."];
  }
  if (/EACCES|EPERM|permission denied|not writable/i.test(message)) {
    return [
      "Give the current user read and write access to the named path.",
      rerunAction(command)
    ];
  }
  if (/ENOENT|not found|Could not find|missing required configuration file/i.test(message)) {
    return [
      "Restore the named file or pass an existing Atlas project or path.",
      rerunAction(command)
    ];
  }
  if (/CORS|fetch|network|HTTP \d|timed out|could not query/i.test(message)) {
    return [
      "Verify the named URL is reachable with the required credentials and CORS policy.",
      rerunAction(command)
    ];
  }
  if (/storage|S3|bucket|registry|deployment lock|lease/i.test(message)) {
    return [
      "Correct the named storage, registry, credentials, or deployment-lock condition.",
      rerunAction(command)
    ];
  }
  if (/tsconfig|TypeScript|atlas\.config|compil|schema|manifest|configuration/i.test(message)) {
    return [
      "Correct the named configuration or TypeScript diagnostic.",
      rerunAction(command)
    ];
  }
  if (/requires? --|Pass --|must be|is required|Unsupported|Unknown option/i.test(message)) {
    return [
      "Correct the named command option or value.",
      command ? `Run \`atlas ${command} --help\` for accepted arguments and examples.` : "Run `atlas --help` for accepted commands and options."
    ];
  }

  switch (command) {
    case "generate":
      return ["Correct the named workspace, framework, project path, or generation option, then rerun `atlas generate`."];
    case "dev":
      return ["Correct the named project, host URL, port, or local build failure, then rerun `atlas dev`."];
    case "build":
    case "build-bootstrap":
    case "compile-config":
      return [`Correct the named configuration or build failure, then rerun \`atlas ${command}\`.`];
    case "publish":
    case "rollback":
    case "remove-pr":
    case "prune-prs":
      return [`Correct the named publication, storage, registry, or CI condition, then rerun \`atlas ${command}\`.`];
    case "verify":
      return ["Correct each failed deployment URL, response header, or artifact, deploy the fix, then rerun `atlas verify`."];
    default:
      return ["Correct the reported input or workspace condition, then rerun the Atlas command."];
  }
}

function rerunAction(command: string | undefined): string {
  return command
    ? `Rerun \`atlas ${command}\` after correcting the condition.`
    : "Rerun the Atlas command after correcting the condition.";
}
