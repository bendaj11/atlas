import { spawn, type ChildProcess } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { delay } from './local-development.driver.js';

const PROCESS_START_TIMEOUT = 120_000;
const PROCESS_STOP_TIMEOUT = 15_000;
const REMOTE_PORT = 4213;
const CONTROL_PORT = 4413;
const BUILD_NOTIFICATIONS_ENDPOINT =
  '/@angular-architects/native-federation:build-notifications';
const SOURCE_PATH = resolve('examples/apps/dashboard-angular/src/entry.ts');
const PACKAGE_PATH = resolve('examples/apps/dashboard-angular/package.json');
const ORIGINAL_HEADING = 'Dashboard Angular';
const UPDATED_HEADING = 'Dashboard Angular Reloaded';

export class AngularLiveDevelopmentDriver {
  private readonly hostUrl = `http://127.0.0.1:${process.env.ATLAS_E2E_ANGULAR_HOST_PORT ?? '4301'}/dashboard-angular`;
  private originalSource = '';
  private originalPackage = '';
  private process?: ChildProcess;

  constructor(private readonly page: Page) {}

  readonly when = {
    start: async (): Promise<void> => {
      this.originalSource = await readFile(SOURCE_PATH, 'utf8');
      this.originalPackage = await readFile(PACKAGE_PATH, 'utf8');
      await writePreviewUrl(PACKAGE_PATH, this.originalPackage, this.hostUrl);
      this.process = spawn(
        process.execPath,
        [
          'packages/cli/dist/cli/entrypoint.js',
          'dev',
          'dashboard-angular',
          `--port=${REMOTE_PORT}`,
          `--control-port=${CONTROL_PORT}`,
          '--no-open',
        ],
        {
          cwd: process.cwd(),
          env: process.env,
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );

      await this.waitForControlServer();
      await this.installDevelopmentSession();
      const notifications = this.page.waitForResponse((response) =>
        response.url().endsWith(BUILD_NOTIFICATIONS_ENDPOINT),
      );
      await this.page.goto(this.hostUrl);
      await notifications;
    },
    changeSignalHeading: async (): Promise<void> => {
      const reload = this.page.waitForEvent('load', { timeout: 30_000 });
      await writeFile(
        SOURCE_PATH,
        this.originalSource.replace(
          `signal('${ORIGINAL_HEADING}')`,
          `signal('${UPDATED_HEADING}')`,
        ),
      );
      await reload;
    },
    stop: async (): Promise<void> => {
      if (this.originalSource)
        await writeFile(SOURCE_PATH, this.originalSource);
      if (this.originalPackage)
        await writeFile(PACKAGE_PATH, this.originalPackage);
      await this.stopProcess();
    },
  };

  readonly get = {
    updatedHeading: () =>
      this.page.getByRole('heading', { name: UPDATED_HEADING }),
  };

  private async installDevelopmentSession(): Promise<void> {
    const sessionUrl = new URL(
      '/atlas.dev-session.json',
      `http://localhost:${CONTROL_PORT}`,
    );
    sessionUrl.searchParams.set(
      'hostId',
      '399e1a5d-f83d-4248-96ed-e4211707ae1b',
    );
    const response = await fetch(sessionUrl);
    if (!response.ok) {
      throw new Error(
        `Atlas development session returned HTTP ${response.status}.`,
      );
    }
    const document = await response.json();
    await this.page.addInitScript((value) => {
      sessionStorage.setItem('atlas.runtime-overrides', JSON.stringify(value));
    }, document);
  }

  private async waitForControlServer(): Promise<void> {
    const output: string[] = [];
    this.process?.stdout?.on('data', (chunk: Buffer) =>
      output.push(chunk.toString()),
    );
    this.process?.stderr?.on('data', (chunk: Buffer) =>
      output.push(chunk.toString()),
    );

    const deadline = Date.now() + PROCESS_START_TIMEOUT;
    while (Date.now() < deadline) {
      if (this.process?.exitCode !== null || this.process?.signalCode !== null)
        throw new Error(`atlas dev exited before startup.\n${output.join('')}`);
      try {
        const response = await fetch(`http://localhost:${CONTROL_PORT}/health`);
        if (response.ok) return;
      } catch {
        await delay(200);
      }
    }
    throw new Error(`atlas dev did not become healthy.\n${output.join('')}`);
  }

  private async stopProcess(): Promise<void> {
    const child = this.process;
    if (!child || child.exitCode !== null || child.signalCode !== null) return;

    await Promise.race([
      new Promise<void>((resolveStop, reject) => {
        child.once('exit', (code, signal) => {
          if (code === 0 || signal === 'SIGINT' || signal === 'SIGTERM')
            resolveStop();
          else
            reject(
              new Error(`atlas dev exited with code ${code ?? 'unknown'}.`),
            );
        });
        child.kill('SIGINT');
      }),
      delay(PROCESS_STOP_TIMEOUT).then(() => {
        child.kill('SIGKILL');
        throw new Error('atlas dev did not stop within 15 seconds.');
      }),
    ]);
  }
}

async function writePreviewUrl(
  packagePath: string,
  source: string,
  previewUrl: string,
): Promise<void> {
  const packageJson = JSON.parse(source) as {
    atlas?: Record<string, unknown>;
  };
  await writeFile(
    packagePath,
    `${JSON.stringify(
      {
        ...packageJson,
        atlas: { ...packageJson.atlas, previews: [previewUrl] },
      },
      null,
      2,
    )}\n`,
  );
}
