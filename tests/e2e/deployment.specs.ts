import { expect, test, type APIRequestContext } from "@playwright/test";
import { copyFile, mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { deploymentCatalog, runCli as runAtlasCli } from "./deployment.driver.js";

const workspaceRoot = resolve(import.meta.dirname, "../..");
const cdnRoot = join(workspaceRoot, "tests/e2e/.artifacts/cdn");
const rollbackRoot = join(workspaceRoot, "tests/e2e/.artifacts/rollback");
const REACT_HOST_ID = "060a7f62-1c95-402c-9993-55749faf36d9";
const ANGULAR_HOST_ID = "399e1a5d-f83d-4248-96ed-e4211707ae1b";
const CATALOG_REACT_ID = "3ae54928-c2c6-491d-b766-6996ce0ef3c8";
const EXTERNAL_SHARED_UI_ID = "745518fc-3b1a-4197-b044-da306b0a02ff";

test("React host mounts an Angular app with native inner routing", async ({ page }) => {
  await page.goto("http://127.0.0.1:4300/angular-orders");
  await expect(page.getByRole("heading", { name: "Orders Angular" })).toBeVisible();
  await page.getByRole("link", { name: "Order 42" }).click();
  await expect(page).toHaveURL(/\/angular-orders\/orders\/42$/);
  await expect(page.getByText("Order details")).toBeVisible();
});

test("Angular host mounts a React app with native inner routing", async ({ page }) => {
  await page.goto("http://127.0.0.1:4301/react-catalog");
  await expect(page.getByRole("heading", { name: "Catalog React" })).toBeVisible();
  const stylesheet = page.locator(`link[data-atlas-style="${CATALOG_REACT_ID}"]`);
  await expect(stylesheet).toHaveAttribute("href", new RegExp(`^http://127\\.0\\.0\\.1:4400/apps/${CATALOG_REACT_ID}/0\\.2\\.0/.+\\.css$`));
  await expect(stylesheet).toHaveAttribute("integrity", /^sha256-/);
  await page.getByRole("link", { name: "Product 42" }).click();
  await expect(page).toHaveURL(/\/react-catalog\/products\/42$/);
  await expect(page.getByRole("paragraph")).toHaveText("Product 42");
});

test("host displays its spinner only after an app requests loading state", async ({ page }) => {
  await page.route("**/order-status-*.js", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 750));
    await route.continue();
  });
  await page.goto("http://127.0.0.1:4300/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard React" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Loading widget");
  await expect(page.getByText("Status: paid")).toBeVisible();
  await expect(page.getByRole("status")).toBeHidden();
});

test("React page app mounts an Angular widget", async ({ page }) => {
  await page.goto("http://127.0.0.1:4300/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard React" })).toBeVisible();
  await expect(page.getByText("Status: paid")).toBeVisible();
});

test("Angular page app mounts a React widget", async ({ page }) => {
  await page.goto("http://127.0.0.1:4301/dashboard-angular");
  await expect(page.getByRole("heading", { name: "Dashboard Angular" })).toBeVisible();
  await expect(page.getByText("External products: 24")).toBeVisible();
  await expect(page.getByText("Internal products: 12")).toBeVisible();
});

test("failed external widget keeps app and successful sibling widget visible", async ({ page }) => {
  let blockedExternalRequests = 0;
  await page.route((url) => url.hostname === "127.0.0.1" && url.port === "4401", (route) => {
    blockedExternalRequests += 1;
    return route.abort();
  });
  await page.goto("http://127.0.0.1:4301/dashboard-angular");
  await expect(page.getByRole("heading", { name: "Dashboard Angular" })).toBeVisible();
  await expect(page.getByText("Internal products: 12")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Unable to load widget");
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  expect(blockedExternalRequests).toBeGreaterThan(0);
});

test("external widget release becomes visible after refresh without catalog sync", async ({ page }) => {
  const registryPath = join(workspaceRoot, "tests/e2e/.artifacts/external-cdn/registry.json");
  const original = await readFile(registryPath, "utf8");
  const requested: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes(`/apps/${EXTERNAL_SHARED_UI_ID}/`)) requested.push(request.url());
  });
  try {
    await page.goto("http://127.0.0.1:4301/dashboard-angular");
    await expect(page.getByText("External products: 24")).toBeVisible();
    expect(requested.some((url) => url.includes("/0.1.0/"))).toBe(true);

    const registry = JSON.parse(original);
    const latest = registry.apps.find((manifest: { version: string }) => manifest.version === "0.2.0");
    if (!latest) throw new Error("External 0.2.0 fixture is missing.");
    registry.selections.apps[EXTERNAL_SHARED_UI_ID] = { version: latest.version, buildId: latest.buildId };
    await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");

    requested.length = 0;
    await page.reload();
    await expect(page.getByText("External products: 24")).toBeVisible();
    expect(requested.some((url) => url.includes("/0.2.0/"))).toBe(true);
  } finally {
    await writeFile(registryPath, original, "utf8");
  }
});

const hostFallbackCases: Array<[string, string]> = [["React", "http://127.0.0.1:4300"], ["Angular", "http://127.0.0.1:4301"]];
for (const [name, origin] of hostFallbackCases) {
  test(`${name} host renders fallback UI when a remote fails`, async ({ page }) => {
    await page.goto(`${origin}/broken`);
    await expect(page.getByRole("alert")).toContainText("Unable to load Broken Example");
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  });
}

test("CDN serves mutable catalogs and immutable app assets with appropriate headers", async ({ request }) => {
  const catalogResponse = await request.get(`http://127.0.0.1:4400/hosts/${REACT_HOST_ID}/catalog.json`);
  expect(catalogResponse.headers()["access-control-allow-origin"]).toBe("*");
  expect(catalogResponse.headers()["cache-control"]).toBe("no-cache");
  const catalog = deploymentCatalog(await catalogResponse.json());
  const manifest = catalog.apps.find((candidate) => candidate.id === CATALOG_REACT_ID);
  expect(manifest).toBeDefined();
  const remoteResponse = await request.get(manifest!.remoteEntryUrl);
  expect(remoteResponse.ok()).toBe(true);
  expect(remoteResponse.headers()["cache-control"]).toContain("immutable");
});

test("a deployed host rolls back and forward without being rebuilt", async ({ page, request }) => {
  await page.goto("http://127.0.0.1:4301/react-catalog");
  await expect(page.getByRole("heading", { name: "Catalog React 0.2.0" })).toBeVisible();

  await selectCatalogRelease("0.1.0");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Catalog React", exact: true })).toBeVisible();
  await expectCatalogVersion(request, "0.1.0");

  await selectCatalogRelease("0.2.0", "release-0.2.0");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Catalog React 0.2.0" })).toBeVisible();
  await expectCatalogVersion(request, "0.2.0");
});

async function selectCatalogRelease(version: string, buildId?: string): Promise<void> {
  const args = [
    "packages/cli/dist/index.js", "rollback", CATALOG_REACT_ID,
    `--version=${version}`,
    "--registry-base-url=http://127.0.0.1:4400",
    `--registry-snapshot=${join(cdnRoot, "registry.json")}`,
    `--publication-directory=${rollbackRoot}`,
    `--publication-plan=${rollbackRoot}.json`,
    "--prepare-only"
  ];
  if (buildId) args.push(`--build-id=${buildId}`);
  await runCli(args);
  await replaceMutableFilesAtomically(rollbackRoot);
}

async function expectCatalogVersion(request: APIRequestContext, version: string): Promise<void> {
  const response = await request.get(`http://127.0.0.1:4400/hosts/${ANGULAR_HOST_ID}/catalog.json?version=${version}`);
  const catalog = deploymentCatalog(await response.json());
  expect(catalog.apps.find((manifest) => manifest.id === CATALOG_REACT_ID)?.version).toBe(version);
}

async function replaceMutableFilesAtomically(sourceRoot: string): Promise<void> {
  for (const source of await listFiles(sourceRoot)) {
    const destination = join(cdnRoot, relative(sourceRoot, source));
    const temporary = `${destination}.atlas-next`;
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(source, temporary);
    await rename(temporary, destination);
  }
}

async function listFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(entries.map((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? listFiles(path) : Promise.resolve(entry.isFile() ? [path] : []);
  }));
  return files.flat();
}

async function runCli(args: string[]): Promise<void> {
  await runAtlasCli(workspaceRoot, args);
}
