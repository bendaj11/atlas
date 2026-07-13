import assert from "node:assert/strict";
import { test } from "@jest/globals";
import { HostServerDriver } from "./server.driver.js";

const hostServer = new HostServerDriver();

test("host server exposes runtime, health, loader, and deep-link shell", () => {
  assert.deepEqual(hostServer.routes(), ["/health/live", "/health/ready", "/atlas.runtime.json", "/atlas.loader.js", "*path"]);
  assert.equal(hostServer.hasAssetPath("/missing.js"), true);
  assert.equal(hostServer.hasAssetPath("/orders/42"), false);
  assert.match(hostServer.shell(), /atlas-host-root/);
  assert.match(hostServer.shell(), /atlas\.loader\.js/);
  assert.match(hostServer.loader(), /requiredLoaderApiVersion/);
  assert.match(hostServer.loader(), /validateIntegrity/);
  assert.match(hostServer.loader(), /widgetProviders/);
  assert.match(hostServer.loader(), /externalAppsDependencies/);
  assert.match(hostServer.loader(), /Clear overrides and reload/);
});

test("host server environment requires only host id and catalog URL", () => {
  const runtime = hostServer.runtime({
    ATLAS_HOST_ID: "customer-host",
    ATLAS_CATALOG_URL: "https://cdn.example/atlas/hosts/customer-host/catalog.json"
  });
  assert.equal(runtime.hostId, "customer-host");
  assert.equal(runtime.allowOverrides, false);
});

test("host server exposes explicitly configured external registries", () => {
  const runtime = hostServer.runtime({
    ATLAS_HOST_ID: "customer-host",
    ATLAS_CATALOG_URL: "https://cdn.example/atlas/hosts/customer-host/catalog.json",
    ATLAS_EXTERNAL_REGISTRY_URLS: "https://team-a.example/atlas, https://team-b.example/atlas/"
  });
  assert.deepEqual(runtime.externalRegistryUrls, ["https://team-a.example/atlas", "https://team-b.example/atlas"]);
});

test("host server rejects insecure external production registries", () => {
  assert.throws(() => hostServer.runtime({
    ATLAS_HOST_ID: "customer-host",
    ATLAS_CATALOG_URL: "https://cdn.example/atlas/hosts/customer-host/catalog.json",
    ATLAS_EXTERNAL_REGISTRY_URLS: "http://team-a.example/atlas"
  }), /must contain HTTPS URLs/);
});
