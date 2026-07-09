import { chromium, expect, test, type BrowserContext, type Page, type Worker } from "@playwright/test";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const builtExtensionPath = resolve("apps/columbus/dist");
const hostUrl = "http://127.0.0.1:4300/dashboard";
const overrideKey = "atlas.runtime-overrides";

interface ExtensionSession {
  context: BrowserContext;
  extensionId: string;
  serviceWorker: Worker;
  extensionDirectory: string;
  userDataDirectory: string;
}

test.describe("Atlas Columbus extension", () => {
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

  test("applies historical versions to all tabs and production to only one tab", async () => {
    const firstHost = await session.context.newPage();
    await firstHost.goto(hostUrl);

    const popup = await openPopup(session, firstHost);
    await editApp(popup, "Dashboard React");
    await popup.getByLabel("Production").check();
    await popup.locator("#production-version").selectOption({ label: "0.0.9" });
    await saveAndWaitForReload(popup, firstHost);
    expect(await storedVersion(firstHost, "localStorage")).toBe("0.0.9");
    await expect(firstHost.getByRole("heading", { name: "Dashboard React Historical" })).toBeVisible();

    const secondHost = await session.context.newPage();
    await secondHost.goto(hostUrl);
    expect(await storedVersion(secondHost, "localStorage")).toBe("0.0.9");

    const tabPopup = await openPopup(session, firstHost);
    await editApp(tabPopup, "Dashboard React");
    await tabPopup.getByText("This tab", { exact: true }).click();
    await tabPopup.getByLabel("Production").check();
    await tabPopup.locator("#production-version").selectOption({ label: "0.1.0" });
    await saveAndWaitForReload(tabPopup, firstHost);
    expect(await storedVersion(firstHost, "sessionStorage")).toBeUndefined();
    expect(await overrideCount(firstHost, "sessionStorage")).toBe(0);
    expect(await storedVersion(secondHost, "localStorage")).toBe("0.0.9");
    await firstHost.close();

    const resetPopup = await openPopup(session, secondHost);
    const resetReload = secondHost.waitForEvent("load");
    await resetPopup.getByLabel("Disable Dashboard React override").click();
    await resetReload;
    expect(await hasOverrideDocument(secondHost, "localStorage")).toBe(false);
  });

  test("switches between PR and local manifests", async () => {
    const host = await session.context.newPage();
    await host.goto(hostUrl);

    const prPopup = await openPopup(session, host);
    await editApp(prPopup, "Dashboard React");
    await prPopup.getByLabel("PR").check();
    await prPopup.locator("#pr-version").selectOption({ label: "0.2.0-pr.42 (pr #42)" });
    await saveAndWaitForReload(prPopup, host);
    expect(await storedReason(host)).toBe("pr");

    const localPopup = await openPopup(session, host);
    await editApp(localPopup, "Dashboard React");
    await localPopup.getByLabel("Base URL").check();
    await localPopup.locator("#custom-url").fill("http://127.0.0.1:4400/dashboard-react/0.2.0-local/local-dev");
    await saveAndWaitForReload(localPopup, host);
    expect(await storedVersion(host, "localStorage")).toBe("custom-url");
    expect(await storedReason(host)).toBe("local");
    await expect(host.getByRole("heading", { name: "Dashboard React Local" })).toBeVisible();
  });

  test("shows actionable errors for non-Atlas pages and invalid local manifests", async () => {
    const nonAtlasPage = await session.context.newPage();
    await nonAtlasPage.goto("data:text/html,<title>Not Atlas</title>");
    const unavailablePopup = await openPopupDocument(session, nonAtlasPage);
    await expect(unavailablePopup.getByRole("status")).toContainText("Open an Atlas host");
    await unavailablePopup.close();

    const host = await session.context.newPage();
    await host.goto(hostUrl);
    const popup = await openPopup(session, host);
    await editApp(popup, "Dashboard React");
    await popup.getByLabel("Base URL").check();
    await popup.locator("#custom-url").fill("not-a-url");
    await popup.getByRole("button", { name: "Save" }).click();
    await expect(popup.getByRole("status")).toContainText("Base URL must be absolute HTTP URL.");
  });
});

async function launchExtension(): Promise<ExtensionSession> {
  const extensionDirectory = await createTestExtension();
  const userDataDirectory = await mkdtemp(join(tmpdir(), "atlas-extension-"));
  const context = await chromium.launchPersistentContext(userDataDirectory, {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${extensionDirectory}`, `--load-extension=${extensionDirectory}`]
  });
  const serviceWorker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
  const extensionId = new URL(serviceWorker.url()).host;
  return { context, extensionDirectory, extensionId, serviceWorker, userDataDirectory };
}

async function openPopup(session: ExtensionSession, host: Page): Promise<Page> {
  const popup = await openPopupDocument(session, host);
  await expect(popup.getByRole("status")).toContainText("apps discovered");
  return popup;
}

async function openPopupDocument(session: ExtensionSession, activePage: Page): Promise<Page> {
  const popup = await session.context.newPage();
  await popup.goto(`chrome-extension://${session.extensionId}/popup.html`);
  await activePage.bringToFront();
  await popup.getByRole("button", { name: "Refresh host data" }).click();
  await expect(popup.getByRole("status")).not.toContainText("Reading the active Atlas host");
  return popup;
}

async function createTestExtension(): Promise<string> {
  const extensionDirectory = await mkdtemp(join(tmpdir(), "atlas-extension-build-"));
  await cp(builtExtensionPath, extensionDirectory, { recursive: true });
  const manifestPath = join(extensionDirectory, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
  manifest.host_permissions = ["http://127.0.0.1/*"];
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return extensionDirectory;
}

async function saveAndWaitForReload(popup: Page, host: Page): Promise<void> {
  const reload = host.waitForEvent("load");
  await popup.getByRole("button", { name: "Save" }).click();
  await reload;
  await expect(host.locator("body")).toBeVisible();
}

async function editApp(popup: Page, appName: string): Promise<void> {
  await popup.locator("article", { hasText: appName }).getByRole("button", { name: "Edit" }).click();
}

type BrowserStorage = "localStorage" | "sessionStorage";

async function readOverride(host: Page, storage: BrowserStorage): Promise<{ overrides: Array<{ manifest: { version: string }; reason: string }> } | undefined> {
  return host.evaluate(({ key, storageName }) => {
    const value = window[storageName].getItem(key);
    return value ? JSON.parse(value) : undefined;
  }, { key: overrideKey, storageName: storage });
}

async function storedVersion(host: Page, storage: BrowserStorage): Promise<string | undefined> {
  return (await readOverride(host, storage))?.overrides[0]?.manifest.version;
}

async function storedReason(host: Page): Promise<string | undefined> {
  return (await readOverride(host, "localStorage"))?.overrides[0]?.reason;
}

async function overrideCount(host: Page, storage: BrowserStorage): Promise<number | undefined> {
  return (await readOverride(host, storage))?.overrides.length;
}

async function hasOverrideDocument(host: Page, storage: BrowserStorage): Promise<boolean> {
  return (await readOverride(host, storage)) !== undefined;
}
