import { expect, test, type APIRequestContext } from '@playwright/test';
import { join, resolve } from 'node:path';
import { runCli as runAtlasCli } from './deployment.driver.js';

const workspaceRoot = resolve(import.meta.dirname, '../..');
const artifactsRoot = resolve(
  workspaceRoot,
  process.env.ATLAS_E2E_ARTIFACTS_DIR ?? 'tests/e2e/.artifacts',
);
const cdnRoot = join(artifactsRoot, 'cdn');
const registryConfig = join(workspaceRoot, 'tests/e2e/atlas.registry.ts');
const REACT_HOST_ID = '060a7f62-1c95-402c-9993-55749faf36d9';
const CATALOG_REACT_ID = '3ae54928-c2c6-491d-b766-6996ce0ef3c8';
const EXTERNAL_SHARED_UI_ID = '745518fc-3b1a-4197-b044-da306b0a02ff';
const cdnOrigin = `http://127.0.0.1:${process.env.ATLAS_E2E_CDN_PORT ?? '4400'}`;
const externalCdnOrigin = `http://127.0.0.1:${process.env.ATLAS_E2E_EXTERNAL_CDN_PORT ?? '4401'}`;
const reactHostOrigin = `http://127.0.0.1:${process.env.ATLAS_E2E_REACT_HOST_PORT ?? '4300'}`;
const angularHostOrigin = `http://127.0.0.1:${process.env.ATLAS_E2E_ANGULAR_HOST_PORT ?? '4301'}`;

test.beforeEach(async ({ page }) => {
  await page.route('http://localhost:4400/atlas.dev-session.json?*', (route) =>
    route.abort(),
  );
});

test('should avoid local development probe when production host loads', async ({
  page,
}) => {
  let localSessionRequests = 0;
  page.on('request', (request) => {
    if (
      request.url().startsWith('http://localhost:4400/atlas.dev-session.json')
    ) {
      localSessionRequests += 1;
    }
  });

  await page.goto(`${reactHostOrigin}/dashboard`);

  expect(localSessionRequests).toBe(0);
});

test('should preserve native inner routing when React host mounts Angular app', async ({
  page,
}) => {
  await page.goto(`${reactHostOrigin}/angular-orders`);
  const heading = page.getByRole('heading', { name: 'Orders Angular' });
  await heading.waitFor({ state: 'visible' });
  await page.getByRole('link', { name: 'Order 42' }).click();
  await page.waitForURL(/\/angular-orders\/orders\/42$/);
  const details = page.getByText('Order details');
  await details.waitFor({ state: 'visible' });

  expect({
    heading: await heading.isVisible(),
    loadingCount: await page
      .getByText('Loading product…', { exact: true })
      .count(),
    details: await details.isVisible(),
    url: page.url(),
  }).toStrictEqual({
    heading: true,
    loadingCount: 0,
    details: true,
    url: `${reactHostOrigin}/angular-orders/orders/42`,
  });
});

test('should preserve styles and inner routing when Angular host mounts React app', async ({
  page,
}) => {
  await page.goto(`${angularHostOrigin}/react-catalog`);
  const heading = page.getByRole('heading', { name: 'Catalog React' });
  await heading.waitFor({ state: 'visible' });
  const stylesheet = page.locator(
    `link[data-atlas-style="${CATALOG_REACT_ID}"]`,
  );
  await stylesheet.waitFor({ state: 'attached' });
  await page.getByRole('link', { name: 'Product 42' }).click();
  await page.waitForURL(/\/react-catalog\/products\/42$/);
  const product = page.getByRole('paragraph');
  await product.waitFor({ state: 'visible' });

  expect({
    heading: await heading.isVisible(),
    loadingCount: await page
      .getByText('Loading product…', { exact: true })
      .count(),
    stylesheetHrefMatches: new RegExp(
      `^${escapeRegex(cdnOrigin)}/apps/${CATALOG_REACT_ID}/0\\.2\\.0/.+\\.css$`,
    ).test((await stylesheet.getAttribute('href')) ?? ''),
    stylesheetIntegrityMatches: /^sha256-/u.test(
      (await stylesheet.getAttribute('integrity')) ?? '',
    ),
    product: await product.textContent(),
    url: page.url(),
  }).toStrictEqual({
    heading: true,
    loadingCount: 0,
    stylesheetHrefMatches: true,
    stylesheetIntegrityMatches: true,
    product: 'Product 42',
    url: `${angularHostOrigin}/react-catalog/products/42`,
  });
});

test('should display spinner only while app requests loading state', async ({
  page,
}) => {
  await page.route('**/order-status-*.js', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 750));
    await route.continue();
  });
  await page.goto(`${reactHostOrigin}/dashboard`);
  const heading = page.getByRole('heading', { name: 'Dashboard React' });
  const status = page.getByRole('status');
  await heading.waitFor({ state: 'visible' });
  await status.waitFor({ state: 'visible' });
  const loadingText = await status.textContent();
  await page.getByText('Status: paid').waitFor({ state: 'visible' });
  await status.waitFor({ state: 'hidden' });

  expect({
    heading: await heading.isVisible(),
    loadingText,
    statusHidden: await status.isHidden(),
  }).toStrictEqual({
    heading: true,
    loadingText: 'Loading widget...',
    statusHidden: true,
  });
});

test('should mount Angular widget when React page requests it', async ({
  page,
}) => {
  await page.goto(`${reactHostOrigin}/dashboard`);
  const heading = page.getByRole('heading', { name: 'Dashboard React' });
  const widget = page.getByText('Status: paid');
  await heading.waitFor({ state: 'visible' });
  await widget.waitFor({ state: 'visible' });

  expect({
    heading: await heading.isVisible(),
    widget: await widget.isVisible(),
  }).toStrictEqual({ heading: true, widget: true });
});

test('should mount React widgets when Angular page requests them', async ({
  page,
}) => {
  await page.goto(`${angularHostOrigin}/dashboard-angular`);
  const heading = page.getByRole('heading', { name: 'Dashboard Angular' });
  const external = page.getByText('External products: 24');
  const internal = page.getByText('Internal products: 12');
  await heading.waitFor({ state: 'visible' });
  await external.waitFor({ state: 'visible' });
  await internal.waitFor({ state: 'visible' });

  expect({
    heading: await heading.isVisible(),
    external: await external.isVisible(),
    internal: await internal.isVisible(),
  }).toStrictEqual({ heading: true, external: true, internal: true });
});

test('should serve mutable and immutable cache policies when deployment loads', async ({
  request,
}) => {
  const deploymentResponse = await request.get(
    `${cdnOrigin}/environments/production/hosts/${REACT_HOST_ID}/manifest.json`,
  );
  const deployment = await deploymentResponse.json();
  const reference = deployment.apps.find((candidate: { path: string }) =>
    candidate.path.includes(CATALOG_REACT_ID),
  );
  if (!reference)
    throw new Error('Catalog React deployment reference is missing.');
  const manifestUrl = new URL(reference.path, `${cdnOrigin}/`).href;
  const manifestResponse = await request.get(manifestUrl);
  const manifest = await manifestResponse.json();
  const remoteResponse = await request.get(
    new URL(manifest.entryPath, manifestUrl).href,
  );
  expect({
    cors: deploymentResponse.headers()['access-control-allow-origin'],
    deploymentCache: deploymentResponse.headers()['cache-control'],
    remoteOk: remoteResponse.ok(),
    remoteCache: remoteResponse.headers()['cache-control'],
  }).toStrictEqual({
    cors: '*',
    deploymentCache: 'no-cache',
    remoteOk: true,
    remoteCache: 'public, max-age=31536000, immutable',
  });
});

test('should roll host backward and forward when exact releases are deployed', async ({
  page,
  request,
}) => {
  await page.goto(`${angularHostOrigin}/react-catalog`);
  await page
    .getByRole('heading', { name: 'Catalog React 0.2.0' })
    .waitFor({ state: 'visible' });

  await selectCatalogRelease('0.1.0');
  await page.reload();
  const oldHeading = page.getByRole('heading', {
    name: 'Catalog React',
    exact: true,
  });
  await oldHeading.waitFor({ state: 'visible' });
  const rollbackVersion = await catalogVersion(request);

  await selectCatalogRelease('0.2.0');
  await page.reload();
  const currentHeading = page.getByRole('heading', {
    name: 'Catalog React 0.2.0',
  });
  await currentHeading.waitFor({ state: 'visible' });

  expect({
    rollbackHeading: await oldHeading.isVisible(),
    rollbackVersion,
    currentHeading: await currentHeading.isVisible(),
    currentVersion: await catalogVersion(request),
  }).toStrictEqual({
    rollbackHeading: false,
    rollbackVersion: '0.1.0',
    currentHeading: true,
    currentVersion: '0.2.0',
  });
});

test('should write only environment state when deployment crosses registry roots', async ({
  request,
}) => {
  await runAtlasCli(
    workspaceRoot,
    [
      'packages/cli/dist/cli/entrypoint.js',
      'deploy',
      EXTERNAL_SHARED_UI_ID,
      '--to=cross-registry-e2e',
      '--version=0.1.0',
      `--source-registry-url=${externalCdnOrigin}`,
      `--target-registry-url=${cdnOrigin}`,
      `--registry-config=${registryConfig}`,
    ],
    { ATLAS_E2E_STORAGE: cdnRoot },
  );

  const environment = await request.get(
    `${cdnOrigin}/environments/cross-registry-e2e/deployment.json`,
  );
  const artifact = await request.get(
    `${cdnOrigin}/apps/${EXTERNAL_SHARED_UI_ID}/0.1.0/manifest.json`,
  );
  expect({
    version: (await environment.json()).apps[EXTERNAL_SHARED_UI_ID]?.version,
    artifactCopied: artifact.ok(),
  }).toStrictEqual({ version: '0.1.0', artifactCopied: false });
});

async function selectCatalogRelease(version: string): Promise<void> {
  const args = [
    'packages/cli/dist/cli/entrypoint.js',
    'deploy',
    CATALOG_REACT_ID,
    '--to=production',
    `--version=${version}`,
    `--registry-url=${cdnOrigin}`,
    `--registry-config=${registryConfig}`,
  ];
  await runCli(args, { ATLAS_E2E_STORAGE: cdnRoot });
}

async function catalogVersion(request: APIRequestContext): Promise<string> {
  const response = await request.get(
    `${cdnOrigin}/environments/production/deployment.json`,
  );
  const environment = await response.json();
  return environment.apps[CATALOG_REACT_ID]?.version ?? '';
}

async function runCli(
  args: string[],
  environment: NodeJS.ProcessEnv,
): Promise<void> {
  await runAtlasCli(workspaceRoot, args, environment);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
