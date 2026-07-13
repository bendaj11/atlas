import { chromium, expect, test, type BrowserContext, type Page, type Worker } from "@playwright/test";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { readOverride, restrictExtensionHosts, type BrowserStorage } from "./extension.driver.js";

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
    await popup.getByText("Production", { exact: true }).click();
    await selectDropdown(popup, "#production-version", "0.0.9");
    await saveAndWaitForReload(popup, firstHost);
    expect(await storedVersion(firstHost, "localStorage")).toBe("0.0.9");
    await expect(firstHost.getByRole("heading", { name: "Dashboard React Historical" })).toBeVisible();

    const secondHost = await session.context.newPage();
    await secondHost.goto(hostUrl);
    expect(await storedVersion(secondHost, "localStorage")).toBe("0.0.9");

    const tabPopup = await openPopup(session, firstHost);
    await editApp(tabPopup, "Dashboard React");
    await tabPopup.getByText("This tab", { exact: true }).click();
    await tabPopup.getByText("Production", { exact: true }).click();
    await selectDropdown(tabPopup, "#production-version", "0.1.0");
    await saveAndWaitForReload(tabPopup, firstHost);
    expect(await storedVersion(firstHost, "sessionStorage")).toBe("0.1.0");
    expect(await overrideCount(firstHost, "sessionStorage")).toBe(1);
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
    await prPopup.getByText("PR", { exact: true }).click();
    await selectDropdown(prPopup, "#pr-version", "0.2.0-pr.42 (pr #42)");
    await saveAndWaitForReload(prPopup, host);
    expect(await storedReason(host)).toBe("pr");

    const localPopup = await openPopup(session, host);
    await editApp(localPopup, "Dashboard React");
    await localPopup.getByText("Custom URL", { exact: true }).click();
    await localPopup.locator("#custom-url").fill("http://127.0.0.1:4400/apps/dashboard-react/0.2.0-local/local-dev");
    await saveAndWaitForReload(localPopup, host);
    expect(await storedVersion(host, "localStorage")).toBe("0.0.0-local");
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
    await popup.getByText("Custom URL", { exact: true }).click();
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
  await expect(popup.getByRole("status")).toContainText("external widget providers discovered");
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
  await restrictExtensionHosts(manifestPath);
  return extensionDirectory;
}

async function saveAndWaitForReload(popup: Page, host: Page): Promise<void> {
  const reload = host.waitForEvent("load");
  await popup.getByRole("button", { name: "Save" }).click();
  await reload;
  await expect(host.locator("body")).toBeVisible();
}

async function editApp(popup: Page, appName: string): Promise<void> {
  await popup.locator(".app-card", { hasText: appName }).getByRole("button", { name: "Edit" }).click();
}

async function selectDropdown(popup: Page, selector: string, option: string): Promise<void> {
  await popup.locator(selector).click();
  await popup.getByRole("option", { name: option, exact: true }).click();
}

async function storedVersion(host: Page, storage: BrowserStorage): Promise<string | undefined> {
  return (await readOverride(host, storage))?.apps[0]?.manifest.version;
}

async function storedReason(host: Page): Promise<string | undefined> {
  return (await readOverride(host, "localStorage"))?.apps[0]?.reason;
}

async function overrideCount(host: Page, storage: BrowserStorage): Promise<number | undefined> {
  const documentValue = await readOverride(host, storage);
  return documentValue ? documentValue.apps.length + (documentValue.host ? 1 : 0) : undefined;
}

async function hasOverrideDocument(host: Page, storage: BrowserStorage): Promise<boolean> {
  return (await readOverride(host, storage)) !== undefined;
}
