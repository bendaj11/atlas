import { chromium, expect, test, type BrowserContext, type Page, type Worker } from "@playwright/test";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { readOverride, restrictExtensionHosts, type BrowserStorage } from "./extension.driver.js";

const builtExtensionPath = resolve("apps/columbus/dist");
const hostUrl = `http://127.0.0.1:${process.env.ATLAS_E2E_REACT_HOST_PORT ?? "4300"}/dashboard`;
const cdnOrigin = `http://127.0.0.1:${process.env.ATLAS_E2E_CDN_PORT ?? "4400"}`;
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
    await selectActiveDropdown(popup, /^0\.0\.9$/);
    await saveAndWaitForReload(popup, firstHost);
    expect(await storedVersion(firstHost, "localStorage")).toBe("0.0.9");
    await expect.poll(() => badgeText(session.serviceWorker, firstHost.url())).toBe("1");
    await expect(firstHost.getByRole("heading", { name: "Dashboard React Historical" })).toBeVisible();

    const secondHost = await session.context.newPage();
    await secondHost.goto(hostUrl);
    expect(await storedVersion(secondHost, "localStorage")).toBe("0.0.9");

    const tabPopup = await openPopup(session, firstHost);
    await editApp(tabPopup, "Dashboard React");
    await tabPopup.getByText("This tab", { exact: true }).click();
    await tabPopup.getByText("Production", { exact: true }).click();
    await selectActiveDropdown(tabPopup, /0\.1\.0/);
    await saveAndWaitForReload(tabPopup, firstHost);
    expect(await storedVersion(firstHost, "sessionStorage")).toBe("0.1.0");
    expect(await overrideCount(firstHost, "sessionStorage")).toBe(1);
    expect(await storedVersion(secondHost, "localStorage")).toBe("0.0.9");
    await firstHost.close();

    const resetPopup = await openPopup(session, secondHost);
    const resetReload = secondHost.waitForEvent("load");
    await resetPopup.getByLabel("Disable Dashboard React override").click();
    await resetReload;
    expect(await overrideCount(secondHost, "localStorage")).toBe(0);
    await expect.poll(() => badgeText(session.serviceWorker, secondHost.url())).toBe("");

    const reopenedPopup = await openPopup(session, secondHost);
    await expect(reopenedPopup.getByLabel("Enable Dashboard React override")).toBeVisible();
  });

  test("switches between PR and local manifests", async () => {
    const host = await session.context.newPage();
    await host.goto(hostUrl);

    const prPopup = await openPopup(session, host);
    await editApp(prPopup, "Dashboard React");
    await prPopup.getByText("PR", { exact: true }).click();
    await selectActiveDropdown(prPopup);
    await saveAndWaitForReload(prPopup, host);
    expect(await storedReason(host)).toBe("pr");

    const localPopup = await openPopup(session, host);
    await editApp(localPopup, "Dashboard React");
    await localPopup.getByText("Custom URL", { exact: true }).click();
    await localPopup.getByPlaceholder("http://localhost:4200").fill(`${cdnOrigin}/apps/56e41bf1-d1b4-486f-a340-5782ee632bad/0.2.0-local/local-dev`);
    await saveAndWaitForReload(localPopup, host);
    expect(await storedVersion(host, "localStorage")).toBe("0.0.0-local");
    expect(await storedReason(host)).toBe("local");
    await expect(host.getByRole("heading", { name: "Dashboard React Local" })).toBeVisible();

    const togglePopup = await openPopup(session, host);
    const toggleReload = host.waitForEvent("load");
    await togglePopup.getByLabel("Disable Dashboard React override").click();
    await toggleReload;

    const toggledPopup = await openPopup(session, host);
    await expect(toggledPopup.getByLabel("Enable Dashboard React override")).toBeVisible();
    const enableReload = host.waitForEvent("load");
    await toggledPopup.getByLabel("Enable Dashboard React override").click();
    await enableReload;

    const clearPopup = await openPopup(session, host);
    const clearReload = host.waitForEvent("load");
    await clearPopup.getByRole("button", { name: "Clear" }).first().click();
    await clearReload;
    await expect.poll(() => badgeText(session.serviceWorker, host.url())).toBe("");

    const reopenedPopup = await openPopup(session, host);
    await expect(reopenedPopup.getByRole("button", { name: "Clear" }).first()).toBeDisabled();
  });

  test("shows actionable errors for non-Atlas pages and invalid local manifests", async () => {
    const nonAtlasPage = await session.context.newPage();
    await nonAtlasPage.goto("data:text/html,<title>Not Atlas</title>");
    const unavailablePopup = await openPopupDocument(session, nonAtlasPage);
    await expect(unavailablePopup.getByText(/Open an Atlas host/)).toBeVisible();
    await unavailablePopup.close();

    const host = await session.context.newPage();
    await host.goto(hostUrl);
    const popup = await openPopup(session, host);
    await editApp(popup, "Dashboard React");
    await popup.getByText("Custom URL", { exact: true }).click();
    await popup.getByPlaceholder("http://localhost:4200").fill("not-a-url");
    await popup.getByRole("button", { name: "Save" }).click();
    await expect(popup.getByText("Base URL must be absolute HTTP URL.")).toBeVisible();
  });

  test("shows active override count on the extension action", async () => {
    const host = await session.context.newPage();
    await host.goto(hostUrl);
    await host.evaluate(() => {
      localStorage.setItem("atlas.runtime-overrides", JSON.stringify({
        schemaVersion: "1",
        hostId: "test-host",
        generatedAt: "2026-01-01T00:00:00.000Z",
        overrides: [{ appId: "orders" }, { appId: "dashboard" }]
      }));
    });

    await host.reload();

    await expect.poll(() => badgeText(session.serviceWorker, host.url())).toBe("2");
  });
});

async function badgeText(serviceWorker: Worker, pageUrl: string): Promise<string> {
  return serviceWorker.evaluate(async (url) => {
    const tab = (await chrome.tabs.query({})).find((candidate) => candidate.url === url);
    return tab?.id === undefined ? "" : chrome.action.getBadgeText({ tabId: tab.id });
  }, pageUrl);
}

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
  await expect(popup.getByText(/artifacts found$/)).toBeVisible();
  return popup;
}

async function openPopupDocument(session: ExtensionSession, activePage: Page): Promise<Page> {
  const popup = await session.context.newPage();
  await popup.goto(`chrome-extension://${session.extensionId}/index.html`);
  const refresh = popup.getByRole("button", { name: "Refresh" });
  await refresh.waitFor();
  await activePage.bringToFront();
  await refresh.click();
  await expect(popup.locator("body")).toContainText(/artifacts found|No Atlas host found/);
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
  await popup.getByRole("row").filter({ hasText: appName }).getByRole("button", { name: "Edit" }).click();
}

async function selectActiveDropdown(popup: Page, option?: string | RegExp): Promise<void> {
  await popup.locator('input[role="combobox"]:not(:disabled)').click();
  const options = popup.getByRole("option");
  await (option === undefined
    ? options.first()
    : options.filter({ hasText: option }).first()
  ).click();
}

async function storedVersion(host: Page, storage: BrowserStorage): Promise<string | undefined> {
  return (await readOverride(host, storage))?.overrides[0]?.manifest.version;
}

async function storedReason(host: Page): Promise<string | undefined> {
  return (await readOverride(host, "localStorage"))?.overrides[0]?.reason;
}

async function overrideCount(host: Page, storage: BrowserStorage): Promise<number | undefined> {
  const documentValue = await readOverride(host, storage);
  return documentValue
    ? documentValue.overrides.length + (documentValue.hostOverride ? 1 : 0)
    : undefined;
}
