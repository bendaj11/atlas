import { expect, test } from "@jest/globals";
import { readColumbusFile, readColumbusJson, readColumbusManifest, runCatalogInterceptor } from "./build.driver.js";

const productionHost = { schemaVersion: "1", kind: "host", id: "test-host", name: "Test Host", version: "1.0.0", buildId: "host-prod", channel: "production", framework: "react", remoteEntryUrl: "https://cdn.test/host/remoteEntry.json", requiredHostSdkVersion: "*", supportedHosts: ["test-host"], placements: [] };
const productionManifest = { schemaVersion: "1", kind: "app", id: "app", name: "App", version: "1.0.0", buildId: "prod", channel: "production", framework: "react", remoteEntryUrl: "https://cdn.test/remoteEntry.json", requiredHostSdkVersion: "*", supportedHosts: ["test-host"], placements: [] };
const localManifest = { ...productionManifest, version: "1.0.0-local", buildId: "local", channel: "local", remoteEntryUrl: "http://127.0.0.1:4500/remoteEntry.json" };

function catalog(apps: unknown[]): Record<string, unknown> {
  return { schemaVersion: "1", hostId: "test-host", revision: "test", generatedAt: "2026-01-01T00:00:00.000Z", host: productionHost, apps };
}

function devSession(manifests: Array<typeof localManifest>): Record<string, unknown> {
  return {
    schemaVersion: "1",
    hostId: "test-host",
    catalog: catalog(manifests),
    overrides: manifests.map((manifest) => ({ appId: manifest.id, manifest })),
    generatedAt: "2026-01-01T00:00:00.000Z"
  };
}

test("Columbus extension build is Manifest V3 with local dev interception", async () => {
  const manifest = await readColumbusManifest();
  expect(manifest.manifest_version).toBe(3);
  expect(manifest.minimum_chrome_version).toBe("111");
  expect(manifest.permissions).toStrictEqual(["activeTab", "scripting", "storage"]);
  expect(manifest.host_permissions).toStrictEqual(["http://localhost/*", "http://127.0.0.1/*"]);
  expect(manifest.content_scripts[0].run_at).toBe("document_start");
  expect(manifest.content_scripts[0].world).toBe("MAIN");
  expect(manifest.content_scripts[0].matches).toStrictEqual(["http://*/*", "https://*/*"]);
  expect(manifest.content_scripts[0].js).toStrictEqual(["content-script.js"]);
  expect(manifest.content_scripts[1].run_at).toBe("document_idle");
  expect(manifest.content_scripts[1].matches).toStrictEqual(["http://*/*", "https://*/*"]);
  expect(manifest.content_scripts[1].js).toStrictEqual(["badge-script.js"]);
  expect(manifest.action.default_popup).toBe("popup.html");
  expect(manifest.action.default_icon).toStrictEqual({
    16: "icons/atlas-16.png",
    32: "icons/atlas-32.png"
  });
  expect(manifest.icons).toStrictEqual({
    16: "icons/atlas-16.png",
    32: "icons/atlas-32.png",
    48: "icons/atlas-48.png",
    128: "icons/atlas-128.png"
  });
  expect(manifest.background.service_worker).toBe("background.js");
});

test("Columbus typecheck cannot overwrite the bundled extension", async () => {
  const packageJson = await readColumbusJson("package.json") as { scripts: { typecheck: string } };

  expect(packageJson.scripts.typecheck).toContain("--noEmit");
});

test("Columbus extension intercepts Atlas catalogs for local dev sessions", async () => {
  const source = await readColumbusFile("dist/content-script.js");
  const sourceModule = await readColumbusFile("src/content-script.ts");
  expect(source).toMatch(/atlas\.dev-session\.json/);
  expect(source).toMatch(/hosts\\\/\(.+catalog\\\.json/);
  expect(source).toMatch(/\.ok/);
  expect(source).toMatch(/void 0/);
  expect(source).toMatch(/window\.fetch/);
  expect(source).toMatch(/overrides\.filter/);
  expect(source).toMatch(/decodeURIComponent/);
  expect(source).toMatch(/\.hostId!==/);
  expect(source).toMatch(/searchParams\.set\("hostId"/);
  expect(source).not.toMatch(/devSessions=new Map/);
  expect(source).toMatch(/atlas\.disabled-local-apps\./);
  expect(sourceModule).toMatch(/enabledOverrides/);
  expect(sourceModule).toMatch(/sessionStorage\.getItem/);
  expect(sourceModule).toMatch(/allowCustomOverrides/);
  expect(sourceModule).toMatch(/isDevSession/);
  expect(sourceModule).toMatch(/manifest\.channel !== "local"/);
});

test("disabled local override falls back to production manifest", async () => {
  const result = await runCatalogInterceptor({
    catalog: catalog([productionManifest]),
    devSession: devSession([localManifest]),
    disabledAppIds: ["app"],
    localDevelopmentIntent: true
  });
  expect((result.catalog as { apps: unknown[] }).apps).toStrictEqual([productionManifest]);
});

test("disabled local-only app is removed from local catalog", async () => {
  const result = await runCatalogInterceptor({
    catalog: catalog([localManifest]),
    devSession: devSession([localManifest]),
    disabledAppIds: ["app"],
    localDevelopmentIntent: true
  });
  expect((result.catalog as { apps: unknown[] }).apps).toStrictEqual([]);
});

test("host override policy prevents dev-session interception", async () => {
  const result = await runCatalogInterceptor({
    allowCustomOverrides: false,
    catalog: catalog([productionManifest]),
    devSession: devSession([localManifest]),
    localDevelopmentIntent: true
  });
  expect(result.devSessionRequests).toBe(0);
});

test("production host does not probe localhost without local development intent", async () => {
  const result = await runCatalogInterceptor({
    catalog: catalog([productionManifest]),
    devSession: devSession([localManifest])
  });
  expect(result.devSessionRequests).toBe(0);
  expect((result.catalog as { apps: unknown[] }).apps).toStrictEqual([productionManifest]);
});

test("production host reads local dev session after local override selection", async () => {
  const result = await runCatalogInterceptor({
    catalog: catalog([productionManifest]),
    devSession: devSession([localManifest]),
    localDevelopmentIntent: true
  });
  expect(result.devSessionRequests).toBe(1);
  expect((result.catalog as { apps: unknown[] }).apps).toStrictEqual([localManifest]);
});

test("loopback host keeps automatic local dev-session discovery", async () => {
  const result = await runCatalogInterceptor({
    catalog: catalog([productionManifest]),
    devSession: devSession([localManifest]),
    pageHostname: "127.0.0.1"
  });
  expect(result.devSessionRequests).toBe(1);
  expect((result.catalog as { apps: unknown[] }).apps).toStrictEqual([localManifest]);
});

test("Columbus extension keeps persisted overrides as fallback without hardcoded hosts", async () => {
  const source = await readColumbusFile("dist/popup.js");
  const hostSource = await readColumbusFile("src/popup/inspect-atlas-host.ts");
  const constants = await readColumbusFile("dist/assets/constants.js");
  expect(constants).toMatch(/atlas\.runtime-overrides/);
  expect(hostSource).toMatch(/manifest\.kind === "host" \? "hosts" : "apps"/);
  expect(source).toMatch(/index\.json/);
  expect(source).not.toMatch(/demo-angular-host|localhost:4300/);
  expect(source).toMatch(/sessionStorage/);
  expect(source).toMatch(/localStorage/);
});

test("Columbus extension keeps the override count badge synced from pages", async () => {
  const background = await readColumbusFile("dist/background.js");
  const badgeScript = await readColumbusFile("dist/badge-script.js");
  expect(background).toMatch(/setBadgeBackgroundColor/);
  expect(background).toMatch(/setBadgeTextColor/);
  expect(background).toMatch(/atlas\.override-count/);
  expect(badgeScript).toMatch(/atlas\.runtime-overrides/);
  expect(badgeScript).toMatch(/atlas\.overrides/);
  expect(badgeScript).toMatch(/atlas\.runtime\.json/);
  expect(badgeScript).toMatch(/chrome\.storage\.local\.get/);
  expect(badgeScript).toMatch(/sendMessage/);
  expect(badgeScript).toMatch(/atlas\.dev-session\.json/);
  expect(badgeScript).toMatch(/atlas\.disabled-local-apps\./);
  expect(badgeScript).toMatch(/setInterval/);
  expect(badgeScript).not.toMatch(/^import/);
});

test("Columbus popup recognizes intercepted local manifests as enabled overrides", async () => {
  const source = await readColumbusFile("src/popup/inspect-atlas-host.ts");
  expect(source).toMatch(/manifest\.channel === "local"/);
  expect(source).toMatch(/reason: "local" as const/);
  expect(source).toMatch(/version\.channel === "production"/);
  expect(source).toMatch(/catalog: productionCatalog/);
});

test("Columbus discovers and labels external widget providers", async () => {
  const host = await readColumbusFile("src/popup/inspect-atlas-host.ts");
  const dashboard = await readColumbusFile("src/popup/components/Dashboard.tsx");
  expect(host).toMatch(/externalRegistryUrls/);
  expect(host).toMatch(/externalAppsDependencies/);
  expect(host).toMatch(/registry\.json/);
  expect(host).toMatch(/createProductionCatalog\(catalog, versions, external\.providers\)/);
  expect(dashboard).toMatch(/External widget provider · not mounted as app/);
});

test("Columbus popup uses fixed scrollable WDS layout and left-aligned toggles", async () => {
  const popup = await readColumbusFile("src/popup/components/PopupApp.tsx");
  const row = await readColumbusFile("src/popup/components/AppOverrideRow.tsx");
  expect(popup).toMatch(/width="560px" height="620px" overflowY="auto" borderRadius="12px"/);
  expect(row).toMatch(/<Text size="medium" weight="bold">/);
  expect(row).toMatch(/<Badge size="tiny"/);
  expect(row.indexOf("<ToggleSwitch")).toBeLessThan(row.indexOf('<Text size="medium"'));
});

test("Columbus labels local selections as custom URLs before comparing build identity", async () => {
  const source = await readColumbusFile("src/popup/manifest-utils.ts");
  expect(source.indexOf('selected.channel === "local"')).toBeLessThan(source.indexOf("versionKey(selected) === versionKey(production)"));
  expect(source).toMatch(/return "Custom URL"/);
});

test("Columbus writes valid semantic versions and persists disabled toggle selections", async () => {
  const constants = await readColumbusFile("src/popup/constants.ts");
  const host = await readColumbusFile("src/popup/atlas-host.ts");
  const controller = await readColumbusFile("src/popup/usePopupController.ts");
  expect(constants).toMatch(/CUSTOM_VERSION = "0\.0\.0-local"/);
  expect(host).toMatch(/atlas\.disabled-overrides/);
  expect(host).toMatch(/readDisabledOverrides/);
  expect(host).toMatch(/writeDisabledOverrides/);
  expect(controller).toMatch(/savedDisabledOverrides\.current = await readDisabledOverrides/);
  expect(controller).toMatch(/await writeDisabledOverrides/);
  expect(controller).toMatch(/normalizeStoredManifest\(manifest\)/);
  expect(host).toMatch(/normalizeStoredManifest\(manifest\)/);
  expect(host).toMatch(/disabledAppIds/);
  expect(host).toMatch(/atlas\.disabled-local-apps\./);
  expect(controller).toMatch(/includeDisabledApps/);
  expect(host).not.toMatch(/disables host and app overrides/);
  expect(host).toMatch(/\.tab\.\$\{tabId\}/);
});

test("Columbus popup displays host identity, version, URL, and environment with WDS", async () => {
  const dashboard = await readColumbusFile("src/popup/components/Dashboard.tsx");
  const summary = await readColumbusFile("src/popup/components/HostSummary.tsx");
  expect(dashboard).toMatch(/<HostSummary hostData=\{hostData\}/);
  expect(summary).toMatch(/versionLabel\(hostData\.catalog\.host\)/);
  expect(summary).toMatch(/Server stable · client/);
  expect(summary).toMatch(/hostData\.pageUrl/);
  expect(summary).toMatch(/<Card/);
  expect(summary).toMatch(/<Badge size="small"/);
  expect(summary).toMatch(/localhost/);
  expect(summary).toMatch(/127\.0\.0\.1/);
});

test("Columbus popup injects a self-contained Atlas host inspector", async () => {
  const hostSource = await readColumbusFile("src/popup/atlas-host.ts");
  const inspector = await readColumbusFile("src/popup/inspect-atlas-host.ts");
  expect(hostSource).toMatch(/func: inspectAtlasHost,\n\s+args: \[DOCUMENT_KEY\]/);
  expect(inspector).toMatch(/export async function inspectAtlasHost\(documentKey: string\): Promise<HostData> {\n\s+function manifestKey/);
  expect(inspector).not.toMatch(/artifactKey\(/);
  expect(inspector).not.toMatch(/^import (?!type)/m);
});

test("Columbus popup uses WDS radio group for selected editor options and labels", async () => {
  const editor = await readColumbusFile("src/popup/components/Editor.tsx");
  const popup = await readColumbusFile("src/popup/components/PopupApp.tsx");
  expect(editor).toMatch(/<RadioGroup/);
  expect(editor).toMatch(/<RadioGroup\.Radio/);
  expect(editor).toMatch(/value=\{draft\.type\}/);
  expect(editor).toMatch(/content=\{\(/);
  expect(editor).toMatch(/Base URL/);
  expect(editor).toMatch(/Production version/);
  expect(editor).toMatch(/PR version/);
  expect(popup).not.toMatch(/StatusCard/);
});

test("Columbus extension defaults to all tabs and offers current-tab scope", async () => {
  const source = await readColumbusFile("dist/popup.js");
  expect(source).toMatch(/All tabs/);
  expect(source).toMatch(/This tab/);
  expect(source).toMatch(/value:"all"/);
  expect(source).toMatch(/value:"tab"/);
});

test("Columbus extension can remove an all-tabs override and preserve a tab production choice", async () => {
  const source = await readColumbusFile("dist/popup.js");
  const hostSource = await readColumbusFile("src/popup/atlas-host.ts");
  expect(source).toMatch(/chrome\.storage\.local\.remove/);
  expect(hostSource).toMatch(/documentValue\.apps\.length/);
  expect(hostSource).toMatch(/documentValue\.host/);
  expect(source).toMatch(/sessionStorage\.setItem/);
});
