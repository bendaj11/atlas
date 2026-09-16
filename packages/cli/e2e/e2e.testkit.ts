import { spawn, type SpawnOptions } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function cliEntrypointPath(): string {
  return fileURLToPath(
    new URL('../dist/cli/entrypoint/entrypoint.js', import.meta.url),
  );
}

export function run(
  command: string,
  args: string[],
  options: SpawnOptions = {},
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const resolvedArgs = args.map((arg) =>
      arg.endsWith('packages/cli/dist/cli/entrypoint/entrypoint.js')
        ? cliEntrypointPath()
        : arg,
    );
    const child = spawn(command, resolvedArgs, { stdio: 'pipe', ...options });
    let stderr = '';
    let stdout = '';
    child.stdout?.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0 ? resolve(stdout + stderr) : reject(new Error(stderr)),
    );
  });
}
