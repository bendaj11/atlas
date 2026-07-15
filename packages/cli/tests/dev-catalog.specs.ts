import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { expect, test } from "@jest/globals";
import { createTestManifest } from "../../testkit/dist/index.js";
import { createDevSession, createLocalDevCatalog, startControlServer } from "../dist/dev.js";
import {
  catalogManifestIds,
  closingJoinedAppPreservesHost,
  devSessionHostId,
  hostJoiningSharedControlBecomesReady,
  localDocument,
  localHostDocument,
  registryArtifactIds,
  run
} from "./build.driver.js";

process.chdir(fileURLToPath(new URL("../../..", import.meta.url)));

const localNetworkTest = process.env.CODEX_SANDBOX_NETWORK_DISABLED === "1" ? test.skip : test;

test("atlas dev prepares an Angular local override without manual URL editing", async () => {
  const stdout = await run(process.execPath, [
    "packages/cli/dist/index.js",
    "dev",
    "orders-angular",
    "--host=399e1a5d-f83d-4248-96ed-e4211707ae1b",
    "--host-url=https://host.example/orders",
    "--port=4511",
    "--control-port=4512",
    "--prepare-only"
  ]);
  const document = JSON.parse(await readFile("examples/apps/orders-angular/.atlas/local-overrides.json", "utf8"));
  expect(document.schemaVersion).toBe("1");
  expect(document.hostId).toBe("399e1a5d-f83d-4248-96ed-e4211707ae1b");
  expect(document.overrides[0].manifest.channel).toBe("local");
  expect(document.overrides[0].manifest.remoteEntryUrl).toBe("http://localhost:4511/remoteEntry.json");
  expect(document.overrides[0].manifest.integrity).toBe(undefined);
  expect(stdout).toMatch(/App Preview: https:\/\/host\.example\/orders/);
  expect(stdout).not.toMatch(/atlas-override/);
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

  expect(catalog.schemaVersion).toBe("1");
  expect(catalog.hostId).toBe("mobile-host");
  expect(catalog.generatedAt).toBe("2026-07-09T08:02:37.622Z");
  expect(catalog.apps).toStrictEqual([manifest]);
  const session = createDevSession({
    schemaVersion: "1",
    hostId: "mobile-host",
    generatedAt: "2026-07-09T08:02:37.622Z",
    overrides: [{ appId: "login", manifest, reason: "local" }]
  }, catalog, "http://localhost:4400/atlas.local-overrides.json");
  expect(session.hostId).toBe("mobile-host");
  expect(session.overrideUrl).toBe("http://localhost:4400/atlas.local-overrides.json");
  expect(session.catalog).toStrictEqual(catalog);
});

localNetworkTest("atlas dev control server accepts multiple local apps for one host", async () => {
  const login = createTestManifest({ id: "login", supportedHosts: ["mobile-host"] });
  const profile = createTestManifest({ id: "profile", supportedHosts: ["mobile-host"] });
  const first = await startControlServer(0, localDocument("mobile-host", login), "");
  const second = await startControlServer(first.port, localDocument("mobile-host", profile), "");

  try {
    await first.markReady();
    expect(await catalogManifestIds(first.port, "mobile-host")).toStrictEqual(["login"]);
    expect(await registryArtifactIds(first.port)).toStrictEqual({ hosts: [], apps: ["login"] });

    await second.markReady();
    expect(await catalogManifestIds(first.port, "mobile-host")).toStrictEqual(["login", "profile"]);
    expect(await registryArtifactIds(first.port)).toStrictEqual({ hosts: [], apps: ["login", "profile"] });

    await second.close();
    expect(await catalogManifestIds(first.port, "mobile-host")).toStrictEqual(["login"]);
    expect(await registryArtifactIds(first.port)).toStrictEqual({ hosts: [], apps: ["login"] });
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

    expect(await catalogManifestIds(angularControl.port, "angular-host")).toStrictEqual(["angular-app"]);
    expect(await catalogManifestIds(angularControl.port, "react-host")).toStrictEqual(["react-app"]);
    expect(await devSessionHostId(angularControl.port, "angular-host")).toBe("angular-host");
    expect(await devSessionHostId(angularControl.port, "react-host")).toBe("react-host");

    await reactControl.close();
    expect(await catalogManifestIds(angularControl.port, "angular-host")).toStrictEqual(["angular-app"]);
  } finally {
    await angularControl.close();
  }
});

localNetworkTest("host dev becomes ready when joining a shared control server", async () => {
  expect(await hostJoiningSharedControlBecomesReady()).toBe("mobile-host");
});

localNetworkTest("atlas dev registry contains ready local host clients", async () => {
  const control = await startControlServer(0, localHostDocument(), "");
  try {
    await control.markReady();
    expect(await registryArtifactIds(control.port)).toStrictEqual({ hosts: ["mobile-host"], apps: [] });
  } finally {
    await control.close();
  }
});

localNetworkTest("closing a joined app keeps the host dev session alive", async () => {
  expect(await closingJoinedAppPreservesHost()).toBe("mobile-host");
});
