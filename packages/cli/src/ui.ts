import { createInterface, type Interface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import selectPrompt from "@inquirer/select";

export interface AtlasPrompter {
  readonly interactive: boolean;
  input(message: string, fallback?: string): Promise<string>;
  select<T extends string>(message: string, choices: readonly { label: string; value: T }[]): Promise<T>;
  close(): void;
}

export class TerminalPrompter implements AtlasPrompter {
  readonly interactive = Boolean(stdin.isTTY && stdout.isTTY && !process.env.CI);
  private interface?: Interface;

  async input(message: string, fallback?: string): Promise<string> {
    if (!this.interactive) throw new Error(`${message} must be provided in non-interactive mode.`);
    while (true) {
      const suffix = fallback ? ` (${fallback})` : "";
      const answer = (await this.reader().question(`${style("?", "cyan")} ${message}${suffix}: `)).trim();
      if (answer) return answer;
      if (fallback) return fallback;
      console.info(style("  A value is required.", "yellow"));
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
  heading(message: string): void { console.info(`\n${style(message, "bold")}`); },
  info(message: string): void { console.info(`${style("->", "cyan")} ${message}`); },
  warning(message: string): void { console.info(`${style("[warn]", "yellow")} ${message}`); },
  success(message: string): void { console.info(`${style("[ok]", "green")} ${message}`); },
  error(message: string): void { console.error(`${style("[error]", "red")} ${message}`); }
};

function style(value: string, color: "bold" | "cyan" | "green" | "yellow" | "red"): string {
  if (!stdout.isTTY || process.env.NO_COLOR) return value;
  const codes = { bold: 1, cyan: 36, green: 32, yellow: 33, red: 31 };
  return `\u001B[${codes[color]}m${value}\u001B[0m`;
}
