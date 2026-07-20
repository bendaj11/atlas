import assert from "node:assert/strict";
import { test } from "@jest/globals";
import {
  ATLAS_BROWSER_LOADER,
  createAtlasBootstrapFiles,
  createBootstrapHtml,
  createNginxConfig,
  validateBootstrapHtml
} from "../dist/index.js";

const runtime = {
  schemaVersion: "1" as const,
  hostId: "customer-host",
  catalogUrl: "https://cdn.example/atlas/hosts/customer-host/catalog.json",
  allowCustomOverrides: true,
  assetOrigins: ["https://assets.example"]
};

test("bootstrap emits complete static deployment bundle", () => {
  const files = new Map(createAtlasBootstrapFiles({ runtime }).map((file) => [file.path, file.contents]));
  assert.deepEqual([...files.keys()], ["index.html", "atlas.loader.js", "atlas.runtime.json", "nginx.conf"]);
  assert.match(files.get("index.html")!, /atlas-host-root/);
  assert.match(files.get("index.html")!, /atlas\.loader\.js/);
  assert.match(files.get("atlas.loader.js")!, /requiredLoaderApiVersion/);
  assert.deepEqual(JSON.parse(files.get("atlas.runtime.json")!), runtime);
  assert.match(files.get("nginx.conf")!, /try_files \$uri \$uri\/ \/index\.html/);
  assert.match(files.get("nginx.conf")!, /location ~ \\\.\[\^\/\]\+\$/);
  assert.match(files.get("nginx.conf")!, /https:\/\/cdn\.example/);
  assert.match(files.get("nginx.conf")!, /http:\/\/localhost:\*/);
});

test("custom overrides permit loopback Vite HMR connections", () => {
  const config = createNginxConfig([], true);
  assert.match(config, /connect-src[^;]*ws:\/\/localhost:\*/);
  assert.match(config, /connect-src[^;]*ws:\/\/127\.0\.0\.1:\*/);
  assert.match(config, /connect-src[^;]*ws:\/\/\[::1\]:\*/);
});

test("production-only bootstrap rejects loopback Vite HMR connections", () => {
  const config = createNginxConfig([], false);
  assert.doesNotMatch(config, /ws:\/\//);
});

test("custom bootstrap HTML keeps required runtime hooks", () => {
  const html = '<main id="atlas-host-root">Custom</main><script type="module" src="/atlas.loader.js"></script>';
  const files = createAtlasBootstrapFiles({ runtime, html });
  assert.equal(files[0]?.contents, `${html}\n`);
});

test("custom bootstrap HTML rejects missing root or loader", () => {
  assert.throws(() => validateBootstrapHtml('<script src="/atlas.loader.js"></script>'), /atlas-host-root/);
  assert.throws(() => validateBootstrapHtml('<main id="atlas-host-root"></main>'), /atlas\.loader\.js/);
});

test("default HTML escapes title and permits custom loading markup", () => {
  const html = createBootstrapHtml({ title: "A < B", loadingHtml: "<strong>Starting</strong>" });
  assert.match(html, /<title>A &lt; B<\/title>/);
  assert.match(html, /<strong>Starting<\/strong>/);
});

test("browser loader removes bootstrap loading markup before mounting host", () => {
  const clearLoadingMarkup = ATLAS_BROWSER_LOADER.indexOf("root.replaceChildren();");
  const mountHost = ATLAS_BROWSER_LOADER.indexOf("await entry.mount(");
  assert.ok(clearLoadingMarkup >= 0);
  assert.ok(clearLoadingMarkup < mountHost);
});

test("browser loader discovers local dev sessions without changing the page URL", () => {
  assert.match(ATLAS_BROWSER_LOADER, /http:\/\/localhost:4400\/atlas\.dev-session\.json/);
  assert.match(ATLAS_BROWSER_LOADER, /searchParams\.set\("hostId", hostId\)/);
  assert.match(ATLAS_BROWSER_LOADER, /if \(!present\.has\(override\.appId\)\) apps\.push\(override\.manifest\)/);
});

test("Nginx fallback never turns missing assets into HTML", () => {
  const config = createNginxConfig();
  assert.match(config, /location ~ \\\.\[\^\/\]\+\$ \{\n    try_files \$uri =404;/);
});
