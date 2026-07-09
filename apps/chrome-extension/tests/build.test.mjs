import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Chrome extension build is Manifest V3 with local dev interception", async () => {
  const manifest = JSON.parse(await readFile(new URL("../dist/manifest.json", import.meta.url), "utf8"));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ["activeTab", "scripting", "storage"]);
  assert.deepEqual(manifest.host_permissions, ["http://localhost/*", "http://127.0.0.1/*"]);
  assert.equal(manifest.content_scripts[0].run_at, "document_start");
  assert.equal(manifest.content_scripts[0].world, "MAIN");
  assert.deepEqual(manifest.content_scripts[0].js, ["content-script.js"]);
  assert.equal(manifest.action.default_popup, "popup.html");
  assert.equal(manifest.background.service_worker, "background.js");
});

test("Chrome extension intercepts Atlas catalogs for local dev sessions", async () => {
  const source = await readFile(new URL("../dist/content-script.js", import.meta.url), "utf8");
  assert.match(source, /atlas\.dev-session\.json/);
  assert.match(source, /ATLAS_CATALOG_PATH/);
  assert.match(source, /catalogResponse\.ok/);
  assert.match(source, /window\.fetch/);
  assert.match(source, /mergeCatalog/);
});

test("Chrome extension keeps persisted overrides as fallback without hardcoded hosts", async () => {
  const source = await readFile(new URL("../dist/popup.js", import.meta.url), "utf8");
  assert.match(source, /atlas\.runtime-overrides/);
  assert.match(source, /microfrontends\/\$\{encodeURIComponent\(manifest\.id\)\}\/index\.json/);
  assert.doesNotMatch(source, /demo-angular-host|localhost:4300/);
  assert.match(source, /sessionStorage/);
  assert.match(source, /localStorage/);
});

test("Chrome extension defaults to all tabs and offers current-tab scope", async () => {
  const html = await readFile(new URL("../dist/popup.html", import.meta.url), "utf8");
  assert.match(html, /value="all" checked/);
  assert.match(html, /All tabs/);
  assert.match(html, /value="tab"/);
  assert.match(html, /This tab/);
});

test("Chrome extension can remove an all-tabs override and preserve a tab production choice", async () => {
  const source = await readFile(new URL("../dist/popup.js", import.meta.url), "utf8");
  assert.match(source, /chrome\.storage\.local\.remove/);
  assert.match(source, /documentValue\.overrides\.length/);
  assert.match(source, /sessionStorage\.setItem\(documentKey, value\)/);
});
