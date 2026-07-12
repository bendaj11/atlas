import assert from "node:assert/strict";
import { test } from "@jest/globals";
import { readColumbusFile, readColumbusManifest, runCatalogInterceptor } from "./build.driver.js";

const productionManifest = { schemaVersion: "1", id: "app", name: "App", version: "1.0.0", buildId: "prod", channel: "production", framework: "react", remoteEntryUrl: "https://cdn.test/remoteEntry.json", requiredHostSdkVersion: "*", supportedHosts: ["test-host"], placements: [] };
const localManifest = { ...productionManifest, version: "1.0.0-local", buildId: "local", channel: "local", remoteEntryUrl: "http://127.0.0.1:4500/remoteEntry.json" };

function catalog(manifests: unknown[]): Record<string, unknown> {
  return { schemaVersion: "1", hostId: "test-host", generatedAt: "2026-01-01T00:00:00.000Z", manifests };
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
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.minimum_chrome_version, "111");
  assert.deepEqual(manifest.permissions, ["activeTab", "scripting", "storage"]);
  assert.deepEqual(manifest.host_permissions, ["http://localhost/*", "http://127.0.0.1/*"]);
  assert.equal(manifest.content_scripts[0].run_at, "document_start");
  assert.equal(manifest.content_scripts[0].world, "MAIN");
  assert.deepEqual(manifest.content_scripts[0].matches, ["http://*/*", "https://*/*"]);
  assert.deepEqual(manifest.content_scripts[0].js, ["content-script.js"]);
  assert.equal(manifest.content_scripts[1].run_at, "document_idle");
  assert.deepEqual(manifest.content_scripts[1].matches, ["http://*/*", "https://*/*"]);
  assert.deepEqual(manifest.content_scripts[1].js, ["badge-script.js"]);
  assert.equal(manifest.action.default_popup, "popup.html");
  assert.deepEqual(manifest.action.default_icon, {
    16: "icons/atlas-16.png",
    32: "icons/atlas-32.png"
  });
  assert.deepEqual(manifest.icons, {
    16: "icons/atlas-16.png",
    32: "icons/atlas-32.png",
    48: "icons/atlas-48.png",
    128: "icons/atlas-128.png"
  });
  assert.equal(manifest.background.service_worker, "background.js");
});

test("Columbus extension intercepts Atlas catalogs for local dev sessions", async () => {
  const source = await readColumbusFile("dist/content-script.js");
  const sourceModule = await readColumbusFile("src/content-script.ts");
  assert.match(source, /atlas\.dev-session\.json/);
  assert.match(source, /hosts\\\/\(.+catalog\\\.json/);
  assert.match(source, /\.ok/);
  assert.match(source, /void 0/);
  assert.match(source, /window\.fetch/);
  assert.match(source, /overrides\.filter/);
  assert.match(source, /decodeURIComponent/);
  assert.match(source, /\.hostId!==/);
  assert.match(source, /searchParams\.set\("hostId"/);
  assert.doesNotMatch(source, /devSessions=new Map/);
  assert.match(source, /atlas\.disabled-local-apps\./);
  assert.match(sourceModule, /enabledOverrides/);
  assert.match(sourceModule, /sessionStorage\.getItem/);
  assert.match(sourceModule, /allowAppOverrides/);
  assert.match(sourceModule, /isDevSession/);
  assert.match(sourceModule, /manifest\.channel !== "local"/);
});

test("disabled local override falls back to production manifest", async () => {
  const result = await runCatalogInterceptor({
    catalog: catalog([productionManifest]),
    devSession: devSession([localManifest]),
    disabledAppIds: ["app"]
  });
  assert.deepEqual((result.catalog as { manifests: unknown[] }).manifests, [productionManifest]);
});

test("disabled local-only app is removed from local catalog", async () => {
  const result = await runCatalogInterceptor({
    catalog: catalog([localManifest]),
    devSession: devSession([localManifest]),
    disabledAppIds: ["app"]
  });
  assert.deepEqual((result.catalog as { manifests: unknown[] }).manifests, []);
});

test("host override policy prevents dev-session interception", async () => {
  const result = await runCatalogInterceptor({
    allowAppOverrides: false,
    catalog: catalog([productionManifest]),
    devSession: devSession([localManifest])
  });
  assert.equal(result.devSessionRequests, 0);
});

test("Columbus extension keeps persisted overrides as fallback without hardcoded hosts", async () => {
  const source = await readColumbusFile("dist/popup.js");
  const constants = await readColumbusFile("dist/assets/constants.js");
  assert.match(constants, /atlas\.runtime-overrides/);
  assert.match(source, /apps\/\$\{encodeURIComponent\(.+?\.id\)\}\/index\.json/);
  assert.doesNotMatch(source, /demo-angular-host|localhost:4300/);
  assert.match(source, /sessionStorage/);
  assert.match(source, /localStorage/);
});

test("Columbus extension keeps the override count badge synced from pages", async () => {
  const background = await readColumbusFile("dist/background.js");
  const badgeScript = await readColumbusFile("dist/badge-script.js");
  assert.match(background, /setBadgeBackgroundColor/);
  assert.match(background, /setBadgeTextColor/);
  assert.match(background, /atlas\.override-count/);
  assert.match(badgeScript, /atlas\.runtime-overrides/);
  assert.match(badgeScript, /atlas\.overrides/);
  assert.match(badgeScript, /atlas\.runtime\.json/);
  assert.match(badgeScript, /chrome\.storage\.local\.get/);
  assert.match(badgeScript, /sendMessage/);
  assert.match(badgeScript, /atlas\.dev-session\.json/);
  assert.match(badgeScript, /atlas\.disabled-local-apps\./);
  assert.match(badgeScript, /setInterval/);
  assert.doesNotMatch(badgeScript, /^import/u);
});

test("Columbus popup recognizes intercepted local manifests as enabled overrides", async () => {
  const source = await readColumbusFile("src/popup/atlas-host.ts");
  assert.match(source, /manifest\.channel === "local"/);
  assert.match(source, /reason: "local" as const/);
  assert.match(source, /version\.channel === "production"/);
  assert.match(source, /catalog: productionCatalog/);
});

test("Columbus popup uses fixed scrollable WDS layout and left-aligned toggles", async () => {
  const popup = await readColumbusFile("src/popup/components/PopupApp.tsx");
  const row = await readColumbusFile("src/popup/components/AppOverrideRow.tsx");
  assert.match(popup, /width="560px" height="620px" overflowY="auto" borderRadius="12px"/);
  assert.match(row, /<Text size="medium" weight="bold">/);
  assert.match(row, /<Badge size="tiny"/);
  assert.ok(row.indexOf("<ToggleSwitch") < row.indexOf('<Text size="medium"'));
});

test("Columbus labels local selections as custom URLs before comparing build identity", async () => {
  const source = await readColumbusFile("src/popup/manifest-utils.ts");
  assert.ok(source.indexOf('selected.channel === "local"') < source.indexOf("versionKey(selected) === versionKey(production)"));
  assert.match(source, /return "Custom URL"/);
});

test("Columbus writes valid semantic versions and persists disabled toggle selections", async () => {
  const constants = await readColumbusFile("src/popup/constants.ts");
  const host = await readColumbusFile("src/popup/atlas-host.ts");
  const controller = await readColumbusFile("src/popup/usePopupController.ts");
  assert.match(constants, /CUSTOM_VERSION = "0\.0\.0-local"/);
  assert.match(host, /atlas\.disabled-overrides/);
  assert.match(host, /readDisabledOverrides/);
  assert.match(host, /writeDisabledOverrides/);
  assert.match(controller, /savedDisabledOverrides\.current = await readDisabledOverrides/);
  assert.match(controller, /await writeDisabledOverrides/);
  assert.match(controller, /normalizeStoredManifest\(override\.manifest\)/);
  assert.match(host, /normalizeStoredManifest\(manifest\)/);
  assert.match(host, /disabledAppIds/);
  assert.match(host, /atlas\.disabled-local-apps\./);
  assert.match(controller, /includeDisabledApps/);
  assert.match(host, /disables app overrides/);
  assert.match(host, /\.tab\.\$\{tabId\}/);
  assert.match(host, /legacyKey/);
});

test("Columbus popup displays host identity, version, URL, and environment with WDS", async () => {
  const dashboard = await readColumbusFile("src/popup/components/Dashboard.tsx");
  const summary = await readColumbusFile("src/popup/components/HostSummary.tsx");
  assert.match(dashboard, /<HostSummary hostData=\{hostData\}/);
  assert.match(summary, /hostVersion \?\? "Unknown"/);
  assert.match(summary, /hostData\.pageUrl/);
  assert.match(summary, /<Card/);
  assert.match(summary, /<Badge size="small"/);
  assert.match(summary, /localhost/);
  assert.match(summary, /127\.0\.0\.1/);
});

test("Columbus popup injects a self-contained Atlas host inspector", async () => {
  const source = await readColumbusFile("src/popup/atlas-host.ts");
  assert.match(source, /func: inspectAtlasHost,\n\s+args: \[DOCUMENT_KEY\]/);
  assert.match(source, /async function inspectAtlasHost\(documentKey: string\): Promise<HostData> {\n\s+async function readAtlasConfig/);
  assert.doesNotMatch(source, /return inspectAtlasHostData\(\)/);
});

test("Columbus popup uses WDS radio group for selected editor options and labels", async () => {
  const editor = await readColumbusFile("src/popup/components/Editor.tsx");
  const popup = await readColumbusFile("src/popup/components/PopupApp.tsx");
  assert.match(editor, /<RadioGroup/);
  assert.match(editor, /<RadioGroup\.Radio/);
  assert.match(editor, /value=\{draft\.type\}/);
  assert.match(editor, /content=\{\(/);
  assert.match(editor, /Base URL/);
  assert.match(editor, /Production version/);
  assert.match(editor, /PR version/);
  assert.doesNotMatch(popup, /StatusCard/);
});

test("Columbus extension defaults to all tabs and offers current-tab scope", async () => {
  const source = await readColumbusFile("dist/popup.js");
  assert.match(source, /All tabs/);
  assert.match(source, /This tab/);
  assert.match(source, /value:"all"/);
  assert.match(source, /value:"tab"/);
});

test("Columbus extension can remove an all-tabs override and preserve a tab production choice", async () => {
  const source = await readColumbusFile("dist/popup.js");
  assert.match(source, /chrome\.storage\.local\.remove/);
  assert.match(source, /overrides\.length/);
  assert.match(source, /sessionStorage\.setItem/);
});
