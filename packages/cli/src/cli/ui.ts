import { createInterface, type Interface } from "node:readline/promises";
import { stderr, stdin, stdout } from "node:process";
import type { WriteStream } from "node:tty";
import selectPrompt from "@inquirer/select";

type UiColor = "bold" | "cyan" | "green" | "yellow" | "red" | "dim";
type Status = "info" | "success" | "warning" | "error";

const STATUS_SYMBOLS: Readonly<Record<Status, string>> = {
  info: "i",
  success: "✓",
  warning: "!",
  error: "✖"
};

const STATUS_COLORS: Readonly<Record<Status, UiColor>> = {
  info: "cyan",
  success: "green",
  warning: "yellow",
  error: "red"
};

export interface AtlasPrompter {
  readonly interactive: boolean;
  input(message: string, fallback?: string): Promise<string>;
  select<T extends string>(message: string, choices: readonly { label: string; value: T }[]): Promise<T>;
  close(): void;
}

export class TerminalPrompter implements AtlasPrompter {
  readonly interactive: boolean;
  private interface?: Interface;

  constructor(inputDisabled = false) {
    this.interactive = Boolean(stdin.isTTY && stdout.isTTY && !process.env.CI && !inputDisabled);
  }

  async input(message: string, fallback?: string): Promise<string> {
    if (!this.interactive) throw new Error(`${message} must be provided in non-interactive mode.`);
    while (true) {
      const suffix = fallback ? ` [${fallback}]` : "";
      const answer = (await this.reader().question(`${style("?", "cyan", stdout)} ${message}${suffix}: `)).trim();
      if (answer) return answer;
      if (fallback) return fallback;
      ui.warning("Value required. Enter a value or press Ctrl+C to cancel.");
    }
  }

  async select<T extends string>(message: string, choices: readonly { label: string; value: T }[]): Promise<T> {
    if (!this.interactive) throw new Error(`${message} must be provided in non-interactive mode.`);
    return selectPrompt({
      message,
      choices: choices.map(({ label, value }) => ({ name: label, value }))
    });
  }

  close(): void { this.interface?.close(); }

  private reader(): Interface {
    this.interface ??= createInterface({ input: stdin, output: stdout });
    return this.interface;
  }
}

export const ui = {
  heading(message: string): void {
    writeLine(stdout, `\n${style("Atlas", "cyan", stdout)} ${style("·", "dim", stdout)} ${style(message, "bold", stdout)}`);
  },
  info(message: string): void { writeStatus(stdout, "info", message); },
  warning(message: string): void { writeStatus(stderr, "warning", message); },
  success(message: string): void { writeStatus(stdout, "success", message); },
  error(message: string): void { writeError(message); },
  item(message: string): void { writeLine(stdout, `  ${style("•", "dim", stdout)} ${message}`); },
  result(label: string, value: string): void {
    writeLine(stdout, `${style(label, "bold", stdout)}: ${value}`);
  }
};

function writeStatus(stream: WriteStream, status: Status, message: string): void {
  const symbol = style(STATUS_SYMBOLS[status], STATUS_COLORS[status], stream);
  writeLine(stream, `${symbol} ${indentContinuationLines(message)}`);
}

function writeError(message: string): void {
  const [summary, action] = message.split(/\s+Suggested actions?:\s+/, 2);
  writeStatus(stderr, "error", summary ?? message);
  if (action) {
    const actions = [...action.matchAll(/(?:^|\s)(\d+)\)\s+(.+?)(?=\s+\d+\)|$)/gu)];
    if (actions.length > 1) {
      writeLine(stderr, `  ${style("Suggested actions:", "bold", stderr)}`);
      actions.forEach((match) => writeLine(stderr, `    ${match[1]}. ${match[2]}`));
    } else {
      writeLine(stderr, `  ${style("Suggested action:", "bold", stderr)} ${action}`);
    }
  }
}

function indentContinuationLines(message: string): string {
  return message.replace(/\n/g, "\n  ");
}

function writeLine(stream: WriteStream, message: string): void {
  if (stream === stderr) console.error(message);
  else console.info(message);
}

function style(value: string, color: UiColor, stream: WriteStream): string {
  if (!stream.isTTY || process.env.NO_COLOR || process.env.TERM === "dumb") return value;
  const codes: Readonly<Record<UiColor, number>> = {
    bold: 1,
    dim: 2,
    cyan: 36,
    green: 32,
    yellow: 33,
    red: 31
  };
  return `\u001B[${codes[color]}m${value}\u001B[0m`;
}
