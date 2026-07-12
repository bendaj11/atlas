import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Columbus extension build is Manifest V3 with local dev interception", async () => {
  const manifest = JSON.parse(await readFile(new URL("../dist/manifest.json", import.meta.url), "utf8"));
  assert.equal(manifest.manifest_version, 3);
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
  const source = await readFile(new URL("../dist/content-script.js", import.meta.url), "utf8");
  assert.match(source, /atlas\.dev-session\.json/);
  assert.match(source, /hosts\\\/\(.+catalog\\\.json/);
  assert.match(source, /\.ok/);
  assert.match(source, /void 0/);
  assert.match(source, /window\.fetch/);
  assert.match(source, /overrides\.map/);
  assert.match(source, /decodeURIComponent/);
  assert.match(source, /\.hostId!==/);
  assert.match(source, /searchParams\.set\("hostId"/);
  assert.match(source, /localStorage\.removeItem/);
  assert.match(source, /sessionStorage\.removeItem/);
});

test("Columbus extension keeps persisted overrides as fallback without hardcoded hosts", async () => {
  const source = await readFile(new URL("../dist/popup.js", import.meta.url), "utf8");
  const constants = await readFile(new URL("../dist/assets/constants.js", import.meta.url), "utf8");
  assert.match(constants, /atlas\.runtime-overrides/);
  assert.match(source, /apps\/\$\{encodeURIComponent\(.+?\.id\)\}\/index\.json/);
  assert.doesNotMatch(source, /demo-angular-host|localhost:4300/);
  assert.match(source, /sessionStorage/);
  assert.match(source, /localStorage/);
});

test("Columbus extension keeps the override count badge synced from pages", async () => {
  const background = await readFile(new URL("../dist/background.js", import.meta.url), "utf8");
  const badgeScript = await readFile(new URL("../dist/badge-script.js", import.meta.url), "utf8");
  assert.match(background, /setBadgeBackgroundColor/);
  assert.match(background, /setBadgeTextColor/);
  assert.match(background, /atlas\.override-count/);
  assert.match(badgeScript, /atlas\.runtime-overrides/);
  assert.match(badgeScript, /atlas\.overrides/);
  assert.match(badgeScript, /atlas\.runtime\.json/);
  assert.match(badgeScript, /chrome\.storage\.local\.get/);
  assert.match(badgeScript, /sendMessage/);
  assert.doesNotMatch(badgeScript, /^import/u);
});

test("Columbus popup injects a self-contained Atlas host inspector", async () => {
  const source = await readFile(new URL("../src/popup/atlas-host.ts", import.meta.url), "utf8");
  assert.match(source, /func: inspectAtlasHost,\n\s+args: \[DOCUMENT_KEY\]/);
  assert.match(source, /async function inspectAtlasHost\(documentKey: string\): Promise<HostData> {\n\s+async function readAtlasConfig/);
  assert.doesNotMatch(source, /return inspectAtlasHostData\(\)/);
});

test("Columbus popup uses WDS radio group for selected editor options and labels", async () => {
  const editor = await readFile(new URL("../src/popup/components/Editor.tsx", import.meta.url), "utf8");
  const popup = await readFile(new URL("../src/popup/components/PopupApp.tsx", import.meta.url), "utf8");
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
  const source = await readFile(new URL("../dist/popup.js", import.meta.url), "utf8");
  assert.match(source, /All tabs/);
  assert.match(source, /This tab/);
  assert.match(source, /value:"all"/);
  assert.match(source, /value:"tab"/);
});

test("Columbus extension can remove an all-tabs override and preserve a tab production choice", async () => {
  const source = await readFile(new URL("../dist/popup.js", import.meta.url), "utf8");
  assert.match(source, /chrome\.storage\.local\.remove/);
  assert.match(source, /overrides\.length/);
  assert.match(source, /sessionStorage\.setItem/);
});
