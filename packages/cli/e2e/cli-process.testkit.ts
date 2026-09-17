import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export interface CliProcessResult {
  code: number | null;
  stderr: string;
  stdout: string;
}

export function runCli({
  args,
  cwd,
}: {
  args: string[];
  cwd?: string;
}): Promise<CliProcessResult> {
  const entrypoint = fileURLToPath(
    new URL('../dist/cli/entrypoint/entrypoint.js', import.meta.url),
  );

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [entrypoint, ...args], {
      cwd,
      stdio: 'pipe',
    });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.once('error', reject);
    child.once('exit', (code) => resolve({ code, stderr, stdout }));
  });
}
