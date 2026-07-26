import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const spawn = require("cross-spawn");
const DEFAULT_MAX_BUFFER = 20 * 1024 * 1024;

export function execute(command, args = [], options = {}) {
  const stdio = options.stdio ?? "pipe";
  const maxBuffer = options.maxBuffer ?? DEFAULT_MAX_BUFFER;
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio,
      windowsHide: true
    });
    const stdout = [];
    const stderr = [];
    let outputSize = 0;

    child.stdout?.on("data", (chunk) => {
      outputSize += chunk.length;
      stdout.push(chunk);
      if (outputSize > maxBuffer) child.kill();
    });
    child.stderr?.on("data", (chunk) => {
      outputSize += chunk.length;
      stderr.push(chunk);
      if (outputSize > maxBuffer) child.kill();
    });
    child.once("error", reject);
    child.once("close", (code, signal) => {
      const result = {
        stdout: Buffer.concat(stdout).toString(options.encoding ?? "utf8"),
        stderr: Buffer.concat(stderr).toString(options.encoding ?? "utf8")
      };
      if (outputSize > maxBuffer) {
        reject(new Error(`${command} output exceeded ${maxBuffer} bytes.`));
        return;
      }
      if (code === 0) {
        resolve(result);
        return;
      }
      const detail = result.stderr.trim() || result.stdout.trim();
      reject(new Error(`${command} exited with code ${code ?? "unknown"}${signal ? ` (${signal})` : ""}.${detail ? `\n${detail}` : ""}`));
    });
  });
}
