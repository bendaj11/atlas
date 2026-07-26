import { spawn as nodeSpawn, type ChildProcess, type StdioOptions } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const spawn = require("cross-spawn") as typeof nodeSpawn;

export interface ProcessCommand {
  command: string;
  args: string[];
  cwd: string;
  stdio?: StdioOptions;
}

export function runProcess(input: ProcessCommand): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(input.command, input.args, {
      cwd: input.cwd,
      stdio: input.stdio ?? "inherit"
    });
    child.once("error", reject);
    child.once("exit", (code) => code === 0
      ? resolve()
      : reject(new Error(`${input.command} exited with code ${code ?? "unknown"}.`)));
  });
}

export function spawnProcess(input: ProcessCommand): ChildProcess {
  return spawn(input.command, input.args, {
    cwd: input.cwd,
    stdio: "inherit"
  });
}
