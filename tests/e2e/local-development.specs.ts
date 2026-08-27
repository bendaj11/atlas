import { expect, test, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { delay } from './local-development.driver.js';

const PROCESS_START_TIMEOUT = 120_000;
const PROCESS_STOP_TIMEOUT = 15_000;
const APP_MOUNT_TIMEOUT = 15_000;
const reactHostOrigin = `http://127.0.0.1:${process.env.ATLAS_E2E_REACT_HOST_PORT ?? '4300'}`;
const angularHostOrigin = `http://127.0.0.1:${process.env.ATLAS_E2E_ANGULAR_HOST_PORT ?? '4301'}`;

interface LocalDevelopmentCase {
  app: string;
  description: string;
  heading: string;
  hostUrl: string;
  remotePort: number;
  controlPort: number;
  newLocalAppId?: string;
  deployedRoute?: {
    heading: string;
    url: string;
  };
}
const cases: LocalDevelopmentCase[] = [
  {
    app: 'dashboard-react',
    description: 'dashboard-react',
    heading: 'Dashboard React',
    hostUrl: `${reactHostOrigin}/dashboard`,
    remotePort: 4211,
    controlPort: 4411,
  },
  {
    app: 'dashboard-angular',
    description: 'dashboard-angular',
    heading: 'Dashboard Angular',
    hostUrl: `${angularHostOrigin}/dashboard-angular`,
    remotePort: 4212,
    controlPort: 4412,
  },
  {
    app: 'dashboard-react',
    description: 'brand-new local app absent from production catalog',
    heading: 'Dashboard React',
    hostUrl: `${reactHostOrigin}/new-local-app`,
    remotePort: 4213,
    controlPort: 4413,
    newLocalAppId: 'e2e-new-local-app',
    deployedRoute: {
      heading: 'Catalog React',
      url: `${reactHostOrigin}/catalog`,
    },
  },
];

test.describe('atlas dev', () => {
  test.describe.configure({ mode: 'serial', timeout: PROCESS_START_TIMEOUT });

  for (const scenario of cases) {
    test(`should render local ${scenario.description} and release ports when development stops`, async ({
      page,
    }) => {
      const process = startAtlasDev(scenario);
      let rendered = false;
      let deployedRouteRendered = false;
      let cleanPreviewUrl = false;
      try {
        await waitForHealthyControlServer(scenario.controlPort, process);
        await installDevelopmentSession(page, scenario);
        const remoteEntryRequest = waitForRemoteEntry(
          page,
          scenario.remotePort,
        );
        await page.goto(scenario.hostUrl);
        await remoteEntryRequest;
        cleanPreviewUrl = page.url() === scenario.hostUrl;
        await page.getByRole('heading', { name: scenario.heading }).waitFor({
          state: 'visible',
          timeout: APP_MOUNT_TIMEOUT,
        });
        rendered = true;
        if (scenario.deployedRoute) {
          await page.goto(scenario.deployedRoute.url);
          await page
            .getByRole('heading', { name: scenario.deployedRoute.heading })
            .waitFor({ state: 'visible', timeout: APP_MOUNT_TIMEOUT });
          deployedRouteRendered = true;
        }
      } finally {
        await stopAtlasDev(process);
      }

      expect({
        cleanPreviewUrl,
        deployedRouteRendered:
          deployedRouteRendered || scenario.deployedRoute === undefined,
        portsReleased: await portsReleased([
          scenario.controlPort,
          scenario.remotePort,
        ]),
        rendered,
      }).toStrictEqual({
        cleanPreviewUrl: true,
        deployedRouteRendered: true,
        portsReleased: true,
        rendered: true,
      });
    });
  }
});

function startAtlasDev(scenario: LocalDevelopmentCase): ChildProcess {
  return spawn(
    process.execPath,
    [
      'packages/cli/dist/cli/entrypoint.js',
      'dev',
      scenario.app,
      `--port=${scenario.remotePort}`,
      `--control-port=${scenario.controlPort}`,
    ],
    {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
}

async function installDevelopmentSession(
  page: Page,
  scenario: LocalDevelopmentCase,
): Promise<void> {
  const sessionUrl = new URL(
    '/atlas.dev-session.json',
    `http://localhost:${scenario.controlPort}`,
  );
  const hostId = developmentHostId(scenario.app);
  sessionUrl.searchParams.set('hostId', hostId);
  const response = await fetch(sessionUrl);
  if (!response.ok) {
    throw new Error(
      `Atlas development session returned HTTP ${response.status}.`,
    );
  }
  const document = configureNewLocalApp(await response.json(), scenario);
  await page.addInitScript((value) => {
    sessionStorage.setItem('atlas.runtime-overrides', JSON.stringify(value));
  }, document);
}

function configureNewLocalApp(
  document: unknown,
  scenario: LocalDevelopmentCase,
): unknown {
  if (!scenario.newLocalAppId || !isDevelopmentSessionDocument(document))
    return document;
  const [override, ...remainingOverrides] = document.overrides;
  if (!override) return document;
  const hostId = developmentHostId(scenario.app);
  const manifest = {
    ...override.manifest,
    id: scenario.newLocalAppId,
    name: 'New Local App',
    supportedHosts: [hostId],
    placements: [
      {
        id: 'new-local-app-route',
        kind: 'route',
        hostId,
        route: { path: '/new-local-app' },
      },
    ],
  };
  return {
    ...document,
    overrides: [
      { ...override, appId: scenario.newLocalAppId, manifest },
      ...remainingOverrides,
    ],
  };
}

function isDevelopmentSessionDocument(value: unknown): value is {
  overrides: Array<{
    appId: string;
    manifest: Record<string, unknown>;
    reason: string;
  }>;
} {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as { overrides?: unknown }).overrides)
  );
}

function developmentHostId(app: string): string {
  return app === 'dashboard-react'
    ? '060a7f62-1c95-402c-9993-55749faf36d9'
    : '399e1a5d-f83d-4248-96ed-e4211707ae1b';
}

async function waitForHealthyControlServer(
  port: number,
  process: ChildProcess,
): Promise<void> {
  const output: string[] = [];
  process.stdout?.on('data', (chunk: Buffer) => output.push(chunk.toString()));
  process.stderr?.on('data', (chunk: Buffer) => output.push(chunk.toString()));

  const deadline = Date.now() + PROCESS_START_TIMEOUT;
  while (Date.now() < deadline) {
    if (process.exitCode !== null) {
      throw new Error(`atlas dev exited before startup.\n${output.join('')}`);
    }
    try {
      const response = await fetch(`http://localhost:${port}/health`);
      if (response.ok) return;
    } catch {
      await delay(200);
    }
  }
  throw new Error(`atlas dev did not become healthy.\n${output.join('')}`);
}

function waitForRemoteEntry(page: Page, port: number): Promise<void> {
  return page
    .waitForRequest(
      (request) => {
        const url = new URL(request.url());
        return (
          url.port === String(port) && url.pathname === '/remoteEntry.json'
        );
      },
      { timeout: PROCESS_START_TIMEOUT },
    )
    .then(() => undefined);
}

async function stopAtlasDev(process: ChildProcess): Promise<void> {
  if (process.exitCode !== null || process.signalCode !== null) return;
  await Promise.race([
    new Promise<void>((resolve, reject) => {
      process.once('exit', (code, signal) => {
        if (code === 0 || signal === 'SIGINT' || signal === 'SIGTERM')
          resolve();
        else
          reject(new Error(`atlas dev exited with code ${code ?? 'unknown'}.`));
      });
      process.kill('SIGINT');
    }),
    delay(PROCESS_STOP_TIMEOUT).then(() => {
      process.kill('SIGKILL');
      throw new Error('atlas dev did not stop within 15 seconds.');
    }),
  ]);
}

async function portsReleased(ports: readonly number[]): Promise<boolean> {
  const deadline = Date.now() + PROCESS_STOP_TIMEOUT;
  while (Date.now() < deadline) {
    const released = await Promise.all(
      ports.map(async (port) => {
        try {
          await fetch(`http://localhost:${port}/health`);
          return false;
        } catch {
          return true;
        }
      }),
    );
    if (released.every(Boolean)) return true;
    await delay(100);
  }
  return false;
}
