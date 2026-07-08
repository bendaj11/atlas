import { expect, test, type APIRequestContext } from "@playwright/test";
import { spawn } from "node:child_process";
import { copyFile, mkdir, readdir, rename } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

const workspaceRoot = resolve(import.meta.dirname, "../..");
const cdnRoot = join(workspaceRoot, "tests/e2e/.artifacts/cdn");
const rollbackRoot = join(workspaceRoot, "tests/e2e/.artifacts/rollback");

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
  const stylesheet = page.locator('link[data-atlas-style="catalog-react"]');
  await expect(stylesheet).toHaveAttribute("href", /^http:\/\/127\.0\.0\.1:4400\/catalog-react\/0\.2\.0\/.+\.css$/);
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
  await expect(page.getByRole("status")).toContainText("Loading Dashboard React");
  await expect(page.getByText("Status: paid")).toBeVisible();
  await expect(page.getByRole("status")).toBeHidden();
});

test("React page app mounts an Angular widget and popup", async ({ page }) => {
  await page.goto("http://127.0.0.1:4300/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard React" })).toBeVisible();
  await expect(page.getByText("Status: paid")).toBeVisible();
  await page.getByRole("button", { name: "Open Angular widget popup" }).click();
  await expect(page.getByText("Status: processing")).toBeVisible();
});

test("Angular page app mounts a React widget and popup", async ({ page }) => {
  await page.goto("http://127.0.0.1:4301/dashboard-angular");
  await expect(page.getByRole("heading", { name: "Dashboard Angular" })).toBeVisible();
  await expect(page.getByText("React products: 24")).toBeVisible();
  await page.getByRole("button", { name: "Open React widget popup" }).click();
  await expect(page.getByText("Products in popup: 42")).toBeVisible();
});

for (const [name, origin] of [["React", "http://127.0.0.1:4300"], ["Angular", "http://127.0.0.1:4301"]] as const) {
  test(`${name} host renders fallback UI when a remote fails`, async ({ page }) => {
    await page.goto(`${origin}/broken`);
    await expect(page.getByRole("alert")).toContainText("Unable to load Broken Example");
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  });
}

test("CDN serves mutable catalogs and immutable app assets with appropriate headers", async ({ request }) => {
  const catalogResponse = await request.get("http://127.0.0.1:4400/hosts/demo-react-host/catalog.json");
  expect(catalogResponse.headers()["access-control-allow-origin"]).toBe("*");
  expect(catalogResponse.headers()["cache-control"]).toBe("no-cache");
  const catalog = await catalogResponse.json() as { manifests: Array<{ id: string; remoteEntryUrl: string }> };
  const manifest = catalog.manifests.find((candidate) => candidate.id === "catalog-react");
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
    "packages/cli/dist/index.js", "rollback", "catalog-react",
    `--version=${version}`,
    "--registry-base-url=http://127.0.0.1:4400",
    `--registry-snapshot=${join(cdnRoot, "registry.json")}`,
    `--publication-directory=${rollbackRoot}`,
    `--publication-plan=${rollbackRoot}.json`
  ];
  if (buildId) args.push(`--build-id=${buildId}`);
  await runCli(args);
  await replaceMutableFilesAtomically(rollbackRoot);
}

async function expectCatalogVersion(request: APIRequestContext, version: string): Promise<void> {
  const response = await request.get(`http://127.0.0.1:4400/hosts/demo-angular-host/catalog.json?version=${version}`);
  const catalog = await response.json() as { manifests: Array<{ id: string; version: string }> };
  expect(catalog.manifests.find((manifest) => manifest.id === "catalog-react")?.version).toBe(version);
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
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(process.execPath, args, { cwd: workspaceRoot, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => code === 0
      ? resolvePromise()
      : reject(new Error(`Atlas CLI exited with code ${code ?? "unknown"}.`)));
  });
}
