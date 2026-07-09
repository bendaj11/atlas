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
  assert.match(source, /=void 0/);
  assert.match(source, /window\.fetch/);
  assert.match(source, /overrides\.map/);
  assert.match(source, /decodeURIComponent/);
  assert.match(source, /\.hostId!==/);
  assert.match(source, /localStorage\.removeItem/);
  assert.match(source, /sessionStorage\.removeItem/);
});

test("Columbus extension keeps persisted overrides as fallback without hardcoded hosts", async () => {
  const source = await readFile(new URL("../dist/popup.js", import.meta.url), "utf8");
  assert.match(source, /atlas\.runtime-overrides/);
  assert.match(source, /microfrontends\/\$\{encodeURIComponent\(.+?\.id\)\}\/index\.json/);
  assert.doesNotMatch(source, /demo-angular-host|localhost:4300/);
  assert.match(source, /sessionStorage/);
  assert.match(source, /localStorage/);
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
