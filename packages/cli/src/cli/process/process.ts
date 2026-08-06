import {
  spawn as nodeSpawn,
  type ChildProcess,
  type StdioOptions,
} from 'node:child_process';
import { createRequire } from 'node:module';
import type { Readable } from 'node:stream';

const require = createRequire(import.meta.url);
const spawn = require('cross-spawn') as typeof nodeSpawn;
const MAX_CAPTURED_OUTPUT_LENGTH = 8_000;
const processOutput = new WeakMap<ChildProcess, () => string>();
const processOutputClosed = new WeakMap<ChildProcess, Promise<void>>();

export interface ProcessCommand {
  command: string;
  args: string[];
  cwd: string;
  stdio?: StdioOptions;
}

export interface ProcessOutputDestinations {
  stdout: Pick<NodeJS.WriteStream, 'write'>;
  stderr: Pick<NodeJS.WriteStream, 'write'>;
}

export function runProcess(input: ProcessCommand): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(input.command, input.args, {
      cwd: input.cwd,
      stdio: input.stdio ?? 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              `${input.command} exited with code ${code ?? 'unknown'}.`,
            ),
          ),
    );
  });
}

export function spawnProcess(input: ProcessCommand): ChildProcess {
  const child = spawn(input.command, input.args, {
    cwd: input.cwd,
    stdio: ['inherit', 'pipe', 'pipe'],
  });
  processOutput.set(child, captureProcessOutput(child));
  processOutputClosed.set(
    child,
    new Promise((resolve) => child.once('close', resolve)),
  );
  return child;
}

export function capturedProcessOutput(child: ChildProcess): string {
  return processOutput.get(child)?.() ?? '';
}

export async function completedProcessOutput(
  child: ChildProcess,
): Promise<string> {
  await processOutputClosed.get(child);
  return capturedProcessOutput(child);
}

export function captureProcessOutput(
  child: Pick<ChildProcess, 'stdout' | 'stderr'>,
  destinations: ProcessOutputDestinations = process,
): () => string {
  let output = '';
  forwardAndCapture(child.stdout, destinations.stdout, append);
  forwardAndCapture(child.stderr, destinations.stderr, append);

  return () => output;

  function append(chunk: Buffer): void {
    output = `${output}${chunk}`.slice(-MAX_CAPTURED_OUTPUT_LENGTH);
  }
}

function forwardAndCapture(
  source: Readable | null,
  destination: Pick<NodeJS.WriteStream, 'write'>,
  append: (chunk: Buffer) => void,
): void {
  source?.on('data', (chunk: Buffer) => {
    append(chunk);
    destination.write(chunk);
  });
}
