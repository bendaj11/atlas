import { spawn, type ChildProcess, type StdioOptions } from "node:child_process";

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
      stdio: input.stdio ?? "inherit",
      shell: process.platform === "win32"
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
    stdio: "inherit",
    shell: process.platform === "win32"
  });
}
