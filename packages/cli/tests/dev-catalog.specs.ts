import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { test } from "@jest/globals";
import { createTestManifest } from "../../testkit/dist/index.js";
import { createDevSession, createLocalDevCatalog, startControlServer } from "../dist/dev.js";
import {
  catalogManifestIds,
  closingJoinedAppPreservesHost,
  devSessionHostId,
  hostJoiningSharedControlBecomesReady,
  localDocument,
  run
} from "./build.driver.js";

process.chdir(fileURLToPath(new URL("../../..", import.meta.url)));

const localNetworkTest = process.env.CODEX_SANDBOX_NETWORK_DISABLED === "1" ? test.skip : test;

test("atlas dev prepares an Angular local override without manual URL editing", async () => {
  const stdout = await run(process.execPath, [
    "packages/cli/dist/index.js",
    "dev",
    "orders-angular",
    "--host=demo-angular-host",
    "--host-url=https://host.example/orders",
    "--port=4511",
    "--control-port=4512",
    "--prepare-only"
  ]);
  const document = JSON.parse(await readFile("examples/apps/orders-angular/.atlas/local-overrides.json", "utf8"));
  assert.equal(document.schemaVersion, "1");
  assert.equal(document.hostId, "demo-angular-host");
  assert.equal(document.overrides[0].manifest.channel, "local");
  assert.equal(document.overrides[0].manifest.remoteEntryUrl, "http://localhost:4511/remoteEntry.json");
  assert.equal(document.overrides[0].manifest.integrity, undefined);
  assert.match(stdout, /App Preview: https:\/\/host\.example\/orders/);
  assert.doesNotMatch(stdout, /atlas-override/);
});

test("atlas dev local catalog contains overridden manifests for fresh hosts", () => {
  const manifest = createTestManifest({
    id: "login",
    name: "Login",
    supportedHosts: ["mobile-host"],
    placements: [
      {
        id: "mobile-host-login-route",
        kind: "route",
        hostId: "mobile-host",
        route: { basePath: "/login" }
      }
    ]
  });
  const catalog = createLocalDevCatalog({
    schemaVersion: "1",
    hostId: "mobile-host",
    generatedAt: "2026-07-09T08:02:37.622Z",
    overrides: [
      { appId: "login", manifest, reason: "local" },
      { appId: "stale-login-registration", manifest, reason: "local" }
    ]
  });

  assert.equal(catalog.schemaVersion, "1");
  assert.equal(catalog.hostId, "mobile-host");
  assert.equal(catalog.generatedAt, "2026-07-09T08:02:37.622Z");
  assert.deepEqual(catalog.apps, [manifest]);
  const session = createDevSession({
    schemaVersion: "1",
    hostId: "mobile-host",
    generatedAt: "2026-07-09T08:02:37.622Z",
    overrides: [{ appId: "login", manifest, reason: "local" }]
  }, catalog, "http://127.0.0.1:4400/atlas.local-overrides.json");
  assert.equal(session.hostId, "mobile-host");
  assert.equal(session.overrideUrl, "http://127.0.0.1:4400/atlas.local-overrides.json");
  assert.deepEqual(session.catalog, catalog);
});

localNetworkTest("atlas dev control server accepts multiple local apps for one host", async () => {
  const login = createTestManifest({ id: "login", supportedHosts: ["mobile-host"] });
  const profile = createTestManifest({ id: "profile", supportedHosts: ["mobile-host"] });
  const first = await startControlServer(0, localDocument("mobile-host", login), "");
  const second = await startControlServer(first.port, localDocument("mobile-host", profile), "");

  try {
    await first.markReady();
    assert.deepEqual(await catalogManifestIds(first.port, "mobile-host"), ["login"]);

    await second.markReady();
    assert.deepEqual(await catalogManifestIds(first.port, "mobile-host"), ["login", "profile"]);

    await second.close();
    assert.deepEqual(await catalogManifestIds(first.port, "mobile-host"), ["login"]);
  } finally {
    await first.close();
  }
});

localNetworkTest("atlas dev control server serves local apps for different hosts", async () => {
  const angularApp = createTestManifest({ id: "angular-app", supportedHosts: ["angular-host"] });
  const reactApp = createTestManifest({ id: "react-app", supportedHosts: ["react-host"] });
  const angularControl = await startControlServer(0, localDocument("angular-host", angularApp), "");
  const reactControl = await startControlServer(angularControl.port, localDocument("react-host", reactApp), "");

  try {
    await angularControl.markReady();
    await reactControl.markReady();

    assert.deepEqual(await catalogManifestIds(angularControl.port, "angular-host"), ["angular-app"]);
    assert.deepEqual(await catalogManifestIds(angularControl.port, "react-host"), ["react-app"]);
    assert.equal(await devSessionHostId(angularControl.port, "angular-host"), "angular-host");
    assert.equal(await devSessionHostId(angularControl.port, "react-host"), "react-host");

    await reactControl.close();
    assert.deepEqual(await catalogManifestIds(angularControl.port, "angular-host"), ["angular-app"]);
  } finally {
    await angularControl.close();
  }
});

localNetworkTest("host dev becomes ready when joining a shared control server", async () => {
  assert.equal(await hostJoiningSharedControlBecomesReady(), "mobile-host");
});

localNetworkTest("closing a joined app keeps the host dev session alive", async () => {
  assert.equal(await closingJoinedAppPreservesHost(), "mobile-host");
});

