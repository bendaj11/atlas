import { COMMAND_HELP, ROOT_COMMANDS, ROOT_EXAMPLES, type CommandHelp, type HelpEntry } from "./help-content.js";

const HELP_FLAGS = new Set(["--help", "-h"]);
const COMMAND_ALIASES: Readonly<Record<string, string>> = { g: "generate" };
const GENERATOR_TYPES = new Set(["host", "app", "widget"]);

export function requestedHelpTopic(values: readonly string[]): readonly string[] | undefined {
  if (values.length === 0) return [];
  if (values[0] === "help") return normalizeTopic(withoutHelpFlags(values.slice(1)));
  if (!values.some((value) => HELP_FLAGS.has(value))) return undefined;
  return normalizeTopic(withoutHelpFlags(values));
}

export function formatHelp(topic: readonly string[]): string {
  if (topic.length === 0) return formatRootHelp();
  const key = topic.join(" ");
  const command = COMMAND_HELP[key];
  if (!command) throw new Error(`Unknown help topic "${key}". Run atlas --help to list commands.`);
  return formatCommandHelp(command);
}

function normalizeTopic(values: readonly string[]): readonly string[] {
  const [command, subcommand] = values;
  if (!command) return [];
  const normalizedCommand = COMMAND_ALIASES[command] ?? command;
  if (normalizedCommand === "generate" && subcommand && GENERATOR_TYPES.has(subcommand)) {
    return [normalizedCommand, subcommand];
  }
  return [normalizedCommand];
}

function withoutHelpFlags(values: readonly string[]): readonly string[] {
  return values.filter((value) => !HELP_FLAGS.has(value));
}

function formatRootHelp(): string {
  return [
    "Atlas CLI",
    "",
    "Build and run TypeScript apps across Angular and React hosts.",
    "",
    "Usage:",
    "  atlas <command> [options]",
    "",
    formatEntries("Commands", ROOT_COMMANDS),
    "",
    formatEntries("Global options", [
      { label: "-h, --help", description: "Show help" },
      { label: "-v, --version", description: "Show the installed Atlas version" }
    ]),
    "",
    formatExamples(ROOT_EXAMPLES),
    "",
    'Run "atlas <command> --help" for detailed command information.'
  ].join("\n");
}

function formatCommandHelp(command: CommandHelp): string {
  const sections = [command.summary, "", "Usage:", `  ${command.usage}`];
  appendEntries(sections, "Arguments", command.arguments);
  appendEntries(sections, "Options", command.options);
  appendEntries(sections, "Advanced options", command.advancedOptions);
  appendEntries(sections, "Environment", command.environment);
  sections.push("", formatExamples(command.examples));
  return sections.join("\n");
}

function appendEntries(output: string[], title: string, entries?: readonly HelpEntry[]): void {
  if (!entries?.length) return;
  output.push("", formatEntries(title, entries));
}

function formatEntries(title: string, entries: readonly HelpEntry[]): string {
  const labelWidth = Math.max(...entries.map(({ label }) => label.length));
  const rows = entries.map(({ label, description }) => `  ${label.padEnd(labelWidth)}  ${description}`);
  return `${title}:\n${rows.join("\n")}`;
}

function formatExamples(examples: readonly string[]): string {
  return `Examples:\n${examples.map((example) => `  ${example}`).join("\n\n")}`;
}
