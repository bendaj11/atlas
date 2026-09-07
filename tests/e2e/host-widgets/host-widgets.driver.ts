import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from '@playwright/test';

type Framework = 'React' | 'Angular';

interface WidgetScenario {
  readonly hostFramework: Framework;
  readonly widgetFramework: Framework;
}

const workspace = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const artifacts = resolve(
  workspace,
  process.env.ATLAS_E2E_ARTIFACTS_DIR ?? 'tests/e2e/.artifacts',
);
const reactHostPort = process.env.ATLAS_E2E_REACT_HOST_PORT ?? '4300';
const angularHostPort = process.env.ATLAS_E2E_ANGULAR_HOST_PORT ?? '4301';

export class HostWidgetsDriver {
  private readonly servers: ChildProcess[] = [];
  private browser?: Browser;
  private page?: Page;

  constructor(private readonly scenario: WidgetScenario) {}

  readonly when = {
    openHost: async (): Promise<void> => {
      await Promise.all([
        this.when.startServer({
          directory: 'cdn',
          port: process.env.ATLAS_E2E_CDN_PORT ?? '4400',
        }),
        this.when.startServer({
          directory: 'external-cdn',
          port: process.env.ATLAS_E2E_EXTERNAL_CDN_PORT ?? '4401',
        }),
        this.when.startServer({
          directory: 'react-bootstrap',
          port: reactHostPort,
          spa: true,
        }),
        this.when.startServer({
          directory: 'angular-bootstrap',
          port: angularHostPort,
          spa: true,
        }),
      ]);
      this.browser = await chromium.launch();
      this.page = await this.browser.newPage();
      this.page.setDefaultTimeout(15000);

      const port =
        this.scenario.hostFramework === 'React'
          ? reactHostPort
          : angularHostPort;
      await this.page.goto(`http://127.0.0.1:${port}/dashboard`);
      await this.get.gallery().waitFor({ state: 'visible' });
    },
    startServer: async (options: {
      directory: string;
      port: string;
      spa?: boolean;
    }): Promise<void> => {
      const server = spawn(
        process.execPath,
        [
          '--import',
          'tsx',
          join(workspace, 'tests/e2e/static-server.ts'),
          `--root=${join(artifacts, options.directory)}`,
          `--port=${options.port}`,
          ...(options.spa ? ['--spa'] : []),
        ],
        { cwd: workspace, stdio: ['ignore', 'pipe', 'pipe'] },
      );
      this.servers.push(server);

      await new Promise<void>((resolveReady, reject) => {
        let errors = '';
        server.stderr?.on('data', (chunk) => {
          errors += String(chunk);
        });
        server.once('error', reject);
        server.once('exit', (code) =>
          reject(
            new Error(`Widget fixture server exited (${code}): ${errors}`),
          ),
        );
        server.stdout?.on('data', (chunk) => {
          if (String(chunk).includes('Serving ')) resolveReady();
        });
      });
    },
    showWidget: async (): Promise<void> => {
      await this.get
        .gallery()
        .getByRole('button', {
          name: `Show ${this.scenario.widgetFramework} widget`,
        })
        .click();
      await this.get
        .widget()
        .getByText(this.get.initialText(), { exact: true })
        .waitFor({ state: 'visible' });
    },
    updateWidget: async (): Promise<void> => {
      await this.get
        .gallery()
        .getByRole('button', {
          name: `Update ${this.scenario.widgetFramework} widget`,
        })
        .click();
      await this.get
        .widget()
        .getByText(this.get.updatedText(), { exact: true })
        .waitFor({ state: 'visible' });
    },
    hideWidget: async (): Promise<void> => {
      await this.get
        .gallery()
        .getByRole('button', {
          name: `Hide ${this.scenario.widgetFramework} widget`,
        })
        .click();
      await this.get.widget().waitFor({ state: 'detached' });
    },
    cleanup: async (): Promise<void> => {
      try {
        await this.browser?.close();
      } finally {
        await Promise.all(
          this.servers.map(async (server) => {
            if (server.exitCode !== null || server.signalCode !== null) return;
            const stopped = once(server, 'exit');
            server.kill('SIGTERM');
            await stopped;
          }),
        );
      }
    },
  };

  readonly get = {
    gallery: () => {
      if (!this.page) throw new Error('Open the host before querying widgets.');
      return this.page.getByRole('region', {
        name: 'Host widgets',
        exact: true,
      });
    },
    widget: () =>
      this.get.gallery().getByRole('region', {
        name: `${this.scenario.widgetFramework} widget`,
        exact: true,
      }),
    initialText: (): string =>
      this.scenario.widgetFramework === 'React'
        ? 'Products: 12'
        : 'Status: pending',
    updatedText: (): string =>
      this.scenario.widgetFramework === 'React'
        ? 'Products: 24'
        : 'Status: paid',
    widgetText: (): Promise<string | null> =>
      this.get
        .widget()
        .getByText(/^(Products: \d+|Status: \w+)$/)
        .textContent(),
    widgetCount: (): Promise<number> => this.get.widget().count(),
  };
}
