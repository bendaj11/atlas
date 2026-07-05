import { createInterface, type Interface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

export interface AtlasPrompter {
  readonly interactive: boolean;
  input(message: string): Promise<string>;
  select<T extends string>(message: string, choices: readonly { label: string; value: T }[]): Promise<T>;
  close(): void;
}

export class TerminalPrompter implements AtlasPrompter {
  readonly interactive = Boolean(stdin.isTTY && stdout.isTTY && !process.env.CI);
  private interface?: Interface;

  async input(message: string): Promise<string> {
    if (!this.interactive) throw new Error(`${message} must be provided in non-interactive mode.`);
    while (true) {
      const answer = (await this.reader().question(`${style("?", "cyan")} ${message}: `)).trim();
      if (answer) return answer;
      console.info(style("  A value is required.", "yellow"));
    }
  }

  async select<T extends string>(message: string, choices: readonly { label: string; value: T }[]): Promise<T> {
    if (!this.interactive) throw new Error(`${message} must be provided in non-interactive mode.`);
    console.info(`${style("?", "cyan")} ${message}`);
    choices.forEach((choice, index) => console.info(`  ${style(String(index + 1), "cyan")}) ${choice.label}`));
    while (true) {
      const answer = (await this.reader().question("  Select: ")).trim();
      const selected = Number(answer) - 1;
      if (Number.isInteger(selected) && choices[selected]) return choices[selected]!.value;
      console.info(style(`  Enter a number from 1 to ${choices.length}.`, "yellow"));
    }
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
