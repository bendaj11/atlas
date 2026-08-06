import { spawn, type ChildProcess } from 'node:child_process';
import type { AtlasConfig } from '@atlas/schema';
import { CliArguments } from '../../cli/arguments.js';
import { closeServer, localOrigin, LOCAL_HOST } from '../http/http.js';
import {
  DEFAULT_CONTROL_PORT,
  DEV_SESSION_PORT_PARAM,
  REMOTE_POLL_INTERVAL_MS,
  REMOTE_START_TIMEOUT_MS,
} from '../constants.js';
import type { DevControlServer } from '../types.js';
import { ui } from '../../cli/ui/ui.js';
import { completedProcessOutput } from '../../cli/process/process.js';

export function frameworkServerArguments(
  framework: AtlasConfig['framework'],
  port: number,
): string[] {
  const portArguments = ['--port', String(port)];
  return framework === 'react'
    ? [...portArguments, '--host', LOCAL_HOST]
    : portArguments;
}

export async function waitForRemoteEntry(
  remoteEntryUrl: string,
  child: ChildProcess,
): Promise<void> {
  const deadline = Date.now() + REMOTE_START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw formatFrameworkServerError(
        `Framework dev server exited before ${remoteEntryUrl} became available.`,
        await completedProcessOutput(child),
      );
    }
    try {
      const response = await fetch(remoteEntryUrl, { cache: 'no-store' });
      if (await remoteEntryIsReady(response)) return;
    } catch {
      // Framework server has not opened its port yet.
    }
    await new Promise((resolve) =>
      setTimeout(resolve, REMOTE_POLL_INTERVAL_MS),
    );
  }
  throw new Error(
    `Framework dev server did not serve ${remoteEntryUrl} within ${REMOTE_START_TIMEOUT_MS / 1000} seconds.`,
  );
}

export async function remoteEntryIsReady(response: Response): Promise<boolean> {
  if (!response.ok) return false;
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return false;
  try {
    const metadata = (await response.json()) as {
      name?: unknown;
      exposes?: unknown;
    };
    return typeof metadata.name === 'string' && Array.isArray(metadata.exposes);
  } catch {
    return false;
  }
}

export function waitForShutdown(
  child: ChildProcess,
  control: DevControlServer,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let stopping = false;
    let childExited = false;
    let serverClosed = false;
    let settled = false;

    const removeSignalListeners = (): void => {
      process.off('SIGINT', stop);
      process.off('SIGTERM', stop);
    };
    const resolveAfterShutdown = (): void => {
      if (settled || !childExited || !serverClosed) return;
      settled = true;
      removeSignalListeners();
      resolve();
    };
    const closeControlServer = async (): Promise<void> => {
      try {
        await control.close();
        serverClosed = true;
        resolveAfterShutdown();
      } catch (error) {
        if (settled) return;
        settled = true;
        removeSignalListeners();
        reject(error);
      }
    };
    const stop = (): void => {
      if (stopping) return;
      stopping = true;
      if (!child.killed) child.kill('SIGTERM');
      void closeControlServer();
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    child.once('error', (error) => {
      if (settled) return;
      settled = true;
      removeSignalListeners();
      void control.close();
      reject(error);
    });
    child.once('exit', (code, signal) => {
      childExited = true;
      void closeControlServer();
      if (stopping || code === 0 || signal === 'SIGTERM') {
        resolveAfterShutdown();
        return;
      }
      if (settled) return;
      settled = true;
      removeSignalListeners();
      void completedProcessOutput(child).then((output) =>
        reject(
          formatFrameworkServerError(
            `Framework dev server exited with code ${code ?? 'unknown'}.`,
            output,
          ),
        ),
      );
    });
  });
}

export function formatFrameworkServerError(
  message: string,
  output: string,
): Error {
  const trimmedOutput = output.trim();
  return new Error(
    trimmedOutput
      ? `${message}\n\nFramework server output:\n${trimmedOutput}`
      : message,
  );
}

export function logHostViewUrl(url: string | undefined): void {
  if (url) {
    ui.result('App preview', url);
    return;
  }
  ui.warning('App preview unresolved. Pass --host-url or set ATLAS_HOST_URL.');
}

export function withDevSessionPort(
  hostUrl: string,
  controlPort: number,
): string {
  if (controlPort === DEFAULT_CONTROL_PORT) return hostUrl;
  const url = new URL(hostUrl);
  url.searchParams.set(DEV_SESSION_PORT_PARAM, String(controlPort));
  return url.href;
}

export function openBrowserWhenReady(
  args: CliArguments,
  url: string | undefined,
): void {
  if (!url || args.hasFlag('no-open')) return;
  const command = browserOpenCommand(url);
  try {
    const child = spawn(command.command, command.args, {
      detached: true,
      stdio: 'ignore',
    });
    child.once('error', () => undefined);
    child.unref();
  } catch {
    // Logged URL remains fallback when platform opener unavailable.
  }
}

export function browserOpenCommand(
  url: string,
  platform: NodeJS.Platform = process.platform,
): { command: string; args: string[] } {
  if (platform === 'darwin') return { command: 'open', args: [url] };
  if (platform === 'win32')
    return { command: 'cmd', args: ['/c', 'start', '', url] };
  return { command: 'xdg-open', args: [url] };
}

export { closeServer, localOrigin };
