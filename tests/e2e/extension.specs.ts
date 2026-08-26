import {
  chromium,
  expect,
  test,
  type BrowserContext,
  type Page,
  type Worker,
} from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  readOverride,
  restrictExtensionHosts,
  type BrowserStorage,
} from './extension.driver.js';
import { delay } from './local-development.driver.js';

const builtExtensionPath = resolve('apps/columbus/dist');
const hostUrl = `http://127.0.0.1:${process.env.ATLAS_E2E_REACT_HOST_PORT ?? '4300'}/dashboard`;
const cdnOrigin = `http://127.0.0.1:${process.env.ATLAS_E2E_CDN_PORT ?? '4400'}`;
const liveRemotePort = 4221;
const liveControlPort = 4421;
const liveSourcePath = resolve('examples/apps/dashboard-react/src/entry.tsx');
const livePackagePath = resolve('examples/apps/dashboard-react/package.json');
interface ExtensionSession {
  context: BrowserContext;
  extensionId: string;
  serviceWorker: Worker;
  extensionDirectory: string;
  userDataDirectory: string;
}
test.describe('Atlas Columbus extension', () => {
  let session: ExtensionSession;

  test.beforeEach(async () => {
    session = await launchExtension();
  });

  test.afterEach(async () => {
    if (!session) return;
    await session.context.close();
    await rm(session.extensionDirectory, { recursive: true, force: true });
    await rm(session.userDataDirectory, { recursive: true, force: true });
  });

  test('should apply historical release to every tab when all-tabs scope is selected', async () => {
    const firstHost = await session.context.newPage();
    await firstHost.goto(hostUrl);
    await selectOtherRelease(session, firstHost, /^0\.0\.9\b/);

    const secondHost = await session.context.newPage();
    await secondHost.goto(hostUrl);

    expect({
      firstVersion: await storedVersion(firstHost, 'localStorage'),
      secondVersion: await storedVersion(secondHost, 'localStorage'),
      badge: await waitForBadgeText(
        session.serviceWorker,
        firstHost.url(),
        '1',
      ),
      historicalHeading: await firstHost
        .getByRole('heading', { name: 'Dashboard React Historical' })
        .isVisible(),
    }).toStrictEqual({
      firstVersion: '0.0.9',
      secondVersion: '0.0.9',
      badge: '1',
      historicalHeading: true,
    });
  });

  test('should apply release to one tab when tab scope is selected', async () => {
    const firstHost = await session.context.newPage();
    await firstHost.goto(hostUrl);
    await selectOtherRelease(session, firstHost, /^0\.0\.9\b/);
    const secondHost = await session.context.newPage();
    await secondHost.goto(hostUrl);

    const tabPopup = await openPopup(session, firstHost);
    await editApp(tabPopup, 'Dashboard React');
    await tabPopup.getByText('This tab', { exact: true }).click();
    await tabPopup.getByText('Other release', { exact: true }).click();
    await selectActiveDropdown(tabPopup, /0\.1\.0/);
    await saveAndWaitForReload(tabPopup, firstHost);

    expect({
      tabVersion: await storedVersion(firstHost, 'sessionStorage'),
      tabOverrides: await overrideCount(firstHost, 'sessionStorage'),
      globalVersion: await storedVersion(secondHost, 'localStorage'),
    }).toStrictEqual({
      tabVersion: '0.1.0',
      tabOverrides: 1,
      globalVersion: '0.0.9',
    });
  });

  test('should clear badge and retain selection when override is disabled', async () => {
    const host = await session.context.newPage();
    await host.goto(hostUrl);
    await selectOtherRelease(session, host, /^0\.0\.9\b/);

    const resetPopup = await openPopup(session, host);
    const resetReload = host.waitForEvent('load');
    await resetPopup.getByLabel('Disable Dashboard React override').click();
    await resetReload;
    const reopenedPopup = await openPopup(session, host);

    expect({
      activeOverrides: await overrideCount(host, 'localStorage'),
      badge: await waitForBadgeText(session.serviceWorker, host.url(), ''),
      canEnable: await reopenedPopup
        .getByLabel('Enable Dashboard React override')
        .isVisible(),
    }).toStrictEqual({ activeOverrides: 0, badge: '', canEnable: true });
  });

  test('should activate preview when PR selection is saved', async () => {
    const host = await session.context.newPage();
    await host.goto(hostUrl);

    const prPopup = await openPopup(session, host);
    await editApp(prPopup, 'Dashboard React');
    await prPopup.getByText('PR / MR preview', { exact: true }).click();
    await selectActiveDropdown(prPopup);
    await saveAndWaitForReload(prPopup, host);

    expect(await storedReason(host)).toBe('pr');
  });

  test('should activate local manifest when custom URL is saved', async () => {
    const host = await session.context.newPage();
    await host.goto(hostUrl);

    const localPopup = await openPopup(session, host);
    await editApp(localPopup, 'Dashboard React');
    await localPopup.getByText('Custom URL', { exact: true }).click();
    await localPopup
      .getByPlaceholder('http://localhost:4200')
      .fill(
        `${cdnOrigin}/apps/56e41bf1-d1b4-486f-a340-5782ee632bad/0.2.0-local/local-dev`,
      );
    await saveAndWaitForReload(localPopup, host);
    const localHeading = host.getByRole('heading', {
      name: 'Dashboard React Local',
    });
    await localHeading.waitFor({ state: 'visible' });

    expect({
      version: await storedVersion(host, 'localStorage'),
      reason: await storedReason(host),
      localHeading: await localHeading.isVisible(),
    }).toStrictEqual({
      version: '0.0.0-local',
      reason: 'local',
      localHeading: true,
    });
  });

  test('should restore override when disabled selection is enabled', async () => {
    const host = await session.context.newPage();
    await host.goto(hostUrl);
    await selectOtherRelease(session, host, /^0\.0\.9\b/);

    const togglePopup = await openPopup(session, host);
    const toggleReload = host.waitForEvent('load');
    await togglePopup.getByLabel('Disable Dashboard React override').click();
    await toggleReload;

    const toggledPopup = await openPopup(session, host);
    await toggledPopup
      .getByLabel('Enable Dashboard React override')
      .waitFor({ state: 'visible' });
    const enableReload = host.waitForEvent('load');
    await toggledPopup.getByLabel('Enable Dashboard React override').click();
    await enableReload;

    expect(await storedVersion(host, 'localStorage')).toBe('0.0.9');
  });

  test('should clear configured override when clear is selected', async () => {
    const host = await session.context.newPage();
    await host.goto(hostUrl);
    await selectOtherRelease(session, host, /^0\.0\.9\b/);

    const clearPopup = await openPopup(session, host);
    const clearReload = host.waitForEvent('load');
    await clearPopup.getByRole('button', { name: 'Clear' }).first().click();
    await clearReload;
    const reopenedPopup = await openPopup(session, host);

    expect({
      badge: await waitForBadgeText(session.serviceWorker, host.url(), ''),
      clearDisabled: await reopenedPopup
        .getByRole('button', { name: 'Clear' })
        .first()
        .isDisabled(),
    }).toStrictEqual({ badge: '', clearDisabled: true });
  });

  test('should show actionable error when page is not an Atlas host', async () => {
    const nonAtlasPage = await session.context.newPage();
    await nonAtlasPage.goto('data:text/html,<title>Not Atlas</title>');
    const unavailablePopup = await openPopupDocument(session, nonAtlasPage);

    await expect(
      unavailablePopup.getByText(/Open an Atlas host/),
    ).toBeVisible();
  });

  test('should show validation error when local manifest URL is invalid', async () => {
    const host = await session.context.newPage();
    await host.goto(hostUrl);
    const popup = await openPopup(session, host);
    await editApp(popup, 'Dashboard React');
    await popup.getByText('Custom URL', { exact: true }).click();
    await popup.getByPlaceholder('http://localhost:4200').fill('not-a-url');
    await popup.getByRole('button', { name: 'Save' }).click();
    await expect(
      popup.getByText('Base URL must be absolute HTTP URL.'),
    ).toBeVisible();
  });

  test('should reject local override when remote entry is unavailable', async () => {
    const host = await session.context.newPage();
    await host.goto(hostUrl);
    const popup = await openPopup(session, host);
    await editApp(popup, 'Dashboard React');
    await popup.getByText('Custom URL', { exact: true }).click();
    await popup
      .getByPlaceholder('http://localhost:4200')
      .fill('http://127.0.0.1:9');
    await popup.getByRole('button', { name: 'Save' }).click();
    await expect(popup.getByRole('alert')).toContainText(
      'Local override remote entry is unreachable',
    );
  });

  test('should reload local preview when source changes', async () => {
    test.setTimeout(120_000);
    const originalSource = await readFile(liveSourcePath, 'utf8');
    const originalPackage = await readFile(livePackagePath, 'utf8');
    await writePreviewUrl(livePackagePath, originalPackage, hostUrl);
    const devProcess = startLiveApp();
    try {
      await waitForLiveApp(devProcess);
      const host = await session.context.newPage();
      const localRemoteRequest = host.waitForRequest(
        (request) => new URL(request.url()).port === String(liveRemotePort),
      );
      const notificationsConnected = host.waitForResponse((response) =>
        response.url().endsWith('/@atlas/federation-build-notifications'),
      );
      await host.goto(`${hostUrl}?atlas-dev-port=${liveControlPort}`);
      await localRemoteRequest;
      await notificationsConnected;
      const badge = await waitForBadgeText(
        session.serviceWorker,
        host.url(),
        '1',
      );

      const popup = await openPopup(session, host);
      await editApp(popup, 'Dashboard React');
      const configuredUrl = await popup
        .getByPlaceholder('http://localhost:4200')
        .inputValue();
      await popup.close();

      const updatedHeading = 'Dashboard React Reloaded';
      const reload = host.waitForEvent('load', { timeout: 30_000 });
      await writeFile(
        liveSourcePath,
        originalSource.replace(
          '<h1>Dashboard React</h1>',
          `<h1>${updatedHeading}</h1>`,
        ),
      );
      await reload;
      const updatedHeadingElement = host.getByRole('heading', {
        name: updatedHeading,
      });
      await updatedHeadingElement.waitFor({ state: 'visible' });
      const headingVisible = await updatedHeadingElement.isVisible();

      expect({ badge, configuredUrl, headingVisible }).toEqual({
        badge: '1',
        configuredUrl: `http://localhost:${liveRemotePort}`,
        headingVisible: true,
      });
    } finally {
      await writeFile(liveSourcePath, originalSource);
      await writeFile(livePackagePath, originalPackage);
      await stopLiveApp(devProcess);
    }
  });

  test('should show active override count when overrides are stored', async () => {
    const host = await session.context.newPage();
    await host.goto(hostUrl);
    await host.evaluate(() => {
      localStorage.setItem(
        'atlas.runtime-overrides',
        JSON.stringify({
          schemaVersion: '1',
          hostId: 'test-host',
          generatedAt: '2026-01-01T00:00:00.000Z',
          overrides: [{ appId: 'orders' }, { appId: 'dashboard' }],
        }),
      );
    });

    await host.reload();

    await expect
      .poll(() => badgeText(session.serviceWorker, host.url()))
      .toBe('2');
  });
});

async function badgeText(
  serviceWorker: Worker,
  pageUrl: string,
): Promise<string> {
  return serviceWorker.evaluate(async (url) => {
    const tab = (await chrome.tabs.query({})).find(
      (candidate) => candidate.url === url,
    );
    return tab?.id === undefined
      ? ''
      : chrome.action.getBadgeText({ tabId: tab.id });
  }, pageUrl);
}

async function selectOtherRelease(
  session: ExtensionSession,
  host: Page,
  version: RegExp,
): Promise<void> {
  const popup = await openPopup(session, host);
  await editApp(popup, 'Dashboard React');
  await popup.getByText('Other release', { exact: true }).click();
  await selectActiveDropdown(popup, version);
  await saveAndWaitForReload(popup, host);
}

async function waitForBadgeText(
  serviceWorker: Worker,
  pageUrl: string,
  expected: string,
): Promise<string> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const value = await badgeText(serviceWorker, pageUrl);
    if (value === expected) return value;
    await delay(100);
  }
  throw new Error(`Columbus badge did not become ${expected}.`);
}

async function launchExtension(): Promise<ExtensionSession> {
  const extensionDirectory = await createTestExtension();
  const userDataDirectory = await mkdtemp(join(tmpdir(), 'atlas-extension-'));
  const context = await chromium.launchPersistentContext(userDataDirectory, {
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${extensionDirectory}`,
      `--load-extension=${extensionDirectory}`,
    ],
  });
  const serviceWorker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent('serviceworker'));
  const extensionId = new URL(serviceWorker.url()).host;
  return {
    context,
    extensionDirectory,
    extensionId,
    serviceWorker,
    userDataDirectory,
  };
}

async function openPopup(session: ExtensionSession, host: Page): Promise<Page> {
  const popup = await openPopupDocument(session, host);
  await popup.getByText(/artifacts found$/).waitFor({ state: 'visible' });
  return popup;
}

async function openPopupDocument(
  session: ExtensionSession,
  activePage: Page,
): Promise<Page> {
  const popup = await session.context.newPage();
  await popup.goto(`chrome-extension://${session.extensionId}/index.html`);
  const refresh = popup.getByRole('button', { name: 'Refresh' });
  await refresh.waitFor();
  await activePage.bringToFront();
  await refresh.click();
  await popup
    .getByText(/artifacts found|No Atlas host found/)
    .waitFor({ state: 'visible' });
  return popup;
}

async function createTestExtension(): Promise<string> {
  const extensionDirectory = await mkdtemp(
    join(tmpdir(), 'atlas-extension-build-'),
  );
  await cp(builtExtensionPath, extensionDirectory, { recursive: true });
  const manifestPath = join(extensionDirectory, 'manifest.json');
  await restrictExtensionHosts(manifestPath);
  return extensionDirectory;
}

async function saveAndWaitForReload(popup: Page, host: Page): Promise<void> {
  const reload = host.waitForEvent('load');
  await popup.getByRole('button', { name: 'Save' }).click();
  await reload;
  await host.locator('body').waitFor({ state: 'visible' });
}

async function editApp(popup: Page, appName: string): Promise<void> {
  await popup
    .getByRole('row')
    .filter({ hasText: appName })
    .getByRole('button', { name: 'Edit' })
    .click();
}

async function selectActiveDropdown(
  popup: Page,
  option?: string | RegExp,
): Promise<void> {
  await popup.locator('input[role="combobox"]:not(:disabled)').click();
  const options = popup.getByRole('option');
  await (
    option === undefined
      ? options.first()
      : options.filter({ hasText: option }).first()
  ).click();
}

async function storedVersion(
  host: Page,
  storage: BrowserStorage,
): Promise<string | undefined> {
  return (await readOverride(host, storage))?.overrides[0]?.manifest.version;
}

async function storedReason(host: Page): Promise<string | undefined> {
  return (await readOverride(host, 'localStorage'))?.overrides[0]?.reason;
}

async function overrideCount(
  host: Page,
  storage: BrowserStorage,
): Promise<number | undefined> {
  const documentValue = await readOverride(host, storage);
  return documentValue
    ? documentValue.overrides.length + (documentValue.hostOverride ? 1 : 0)
    : undefined;
}

function startLiveApp(): ChildProcess {
  return spawn(
    process.execPath,
    [
      'packages/cli/dist/cli/entrypoint.js',
      'dev',
      'dashboard-react',
      `--port=${liveRemotePort}`,
      `--control-port=${liveControlPort}`,
      '--no-open',
    ],
    {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
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

async function waitForLiveApp(devProcess: ChildProcess): Promise<void> {
  const output: string[] = [];
  devProcess.stdout?.on('data', (chunk: Buffer) =>
    output.push(chunk.toString()),
  );
  devProcess.stderr?.on('data', (chunk: Buffer) =>
    output.push(chunk.toString()),
  );
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (devProcess.exitCode !== null || devProcess.signalCode !== null)
      throw new Error(`atlas dev exited before startup.\n${output.join('')}`);
    try {
      const response = await fetch(
        `http://localhost:${liveControlPort}/health`,
      );
      if (response.ok) return;
    } catch {
      await delay(200);
    }
  }
  throw new Error(`atlas dev did not become healthy.\n${output.join('')}`);
}

async function stopLiveApp(devProcess: ChildProcess): Promise<void> {
  if (devProcess.exitCode !== null || devProcess.signalCode !== null) return;
  await Promise.race([
    new Promise<void>((resolveStop) => {
      devProcess.once('exit', () => resolveStop());
      devProcess.kill('SIGINT');
    }),
    delay(15_000).then(() => {
      devProcess.kill('SIGKILL');
    }),
  ]);
}
