import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@jest/globals";
import type { AtlasHostManifest, AtlasStaticRegistry } from "../../schema/dist/index.js";
import { createTestManifest } from "../../testkit/dist/index.js";
import { prepareStaticRegistry, prepareStaticRollback, registryRevision } from "../dist/static-registry.js";
import { readCatalog, readManifestIndex, readRegistry } from "./static-registry.driver.js";

test("static registry selects one host client and its apps", async () => {
  const directory = await mkdtemp(join(tmpdir(), "atlas-static-registry-"));
  await prepareStaticRegistry(hostManifest(), undefined, directory);
  const afterHost = await readRegistry(join(directory, "registry.json"));
  await prepareStaticRegistry(createTestManifest({ id: "orders" }), afterHost, directory);

  const index = await readManifestIndex(join(directory, "apps/orders/index.json"));
  const catalog = await readCatalog(join(directory, "hosts/host/catalog.json"));
  expect(index.manifests.map((manifest) => manifest.id)).toStrictEqual(["orders"]);
  expect(catalog.host.kind).toBe("host");
  expect(catalog.apps.map((manifest) => manifest.id)).toStrictEqual(["orders"]);
});

test("provider-only apps remain discoverable without entering a host catalog", async () => {
  const directory = await mkdtemp(join(tmpdir(), "atlas-static-widget-provider-"));
  await prepareStaticRegistry(hostManifest(), undefined, directory);
  const afterHost = await readRegistry(join(directory, "registry.json"));
  const provider = createTestManifest({
    id: "shared-widgets",
    supportedHosts: ["*"],
    placements: [],
    exportedWidgets: [{
      schemaVersion: "1",
      contractVersion: "1",
      id: "55ca3323-c62f-44de-9194-6ab42375e578",
      name: "Shared summary",
      ownerAppId: "shared-widgets",
      framework: "react",
      remoteEntryUrl: "https://cdn.example/apps/shared-widgets/1.0.0/test/remoteEntry.json",
      expose: "./shared-summary"
    }]
  });

  await prepareStaticRegistry(provider, afterHost, directory);

  const registry = await readRegistry(join(directory, "registry.json"));
  const catalog = await readCatalog(join(directory, "hosts/host/catalog.json"));
  expect(registry.apps.some((manifest) => manifest.id === provider.id)).toBe(true);
  expect(catalog.apps).toStrictEqual([]);
});

test("PR builds enter history without activating catalog", async () => {
  const directory = await mkdtemp(join(tmpdir(), "atlas-static-pr-"));
  await prepareStaticRegistry(hostManifest(), undefined, directory);
  let current = await readRegistry(join(directory, "registry.json"));
  await prepareStaticRegistry(createTestManifest({ version: "1.0.0", buildId: "one" }), current, directory);
  current = await readRegistry(join(directory, "registry.json"));
  const result = await prepareStaticRegistry(createTestManifest({ version: "2.0.0-pr.1", buildId: "pr", channel: "pr", prNumber: 1 }), current, directory);

  const index = await readManifestIndex(join(directory, "apps/catalog/index.json"));
  const catalog = await readCatalog(join(directory, "hosts/host/catalog.json"));
  expect(result.hostIds.length).toBe(0);
  expect(index.manifests.length).toBe(2);
  expect(catalog.apps[0]?.version).toBe("1.0.0");
});

test("rollback selects previous host-client build", async () => {
  const directory = await mkdtemp(join(tmpdir(), "atlas-static-host-rollback-"));
  const first = hostManifest({ version: "1.0.0", buildId: "one" });
  const second = hostManifest({ version: "2.0.0", buildId: "two" });
  await prepareStaticRegistry(first, undefined, directory);
  let current = await readRegistry(join(directory, "registry.json"));
  const orders = createTestManifest({ id: "orders", version: "3.0.0", buildId: "orders-three" });
  await prepareStaticRegistry(orders, current, directory);
  current = await readRegistry(join(directory, "registry.json"));
  await prepareStaticRegistry(second, current, directory);
  current = await readRegistry(join(directory, "registry.json"));

  const result = await prepareStaticRollback({
    artifactId: "host",
    version: "1.0.0",
    current,
    outputDirectory: directory,
    updatedAt: "2026-02-01T00:00:00.000Z"
  });
  const catalog = await readCatalog(join(directory, "hosts/host/catalog.json"));
  expect(result.selected.kind).toBe("host");
  expect(catalog.host.buildId).toBe("one");
  expect(catalog.apps.find((manifest) => manifest.id === "orders")?.buildId).toBe("orders-three");
});

test("rollback requires build id when version has multiple builds", async () => {
  const first = createTestManifest({ version: "1.0.0", buildId: "one" });
  const rebuilt = createTestManifest({ version: "1.0.0", buildId: "two" });
  const current: AtlasStaticRegistry = {
    schemaVersion: "1",
    updatedAt: first.createdAt,
    hosts: [hostManifest()],
    apps: [first, rebuilt]
  };
  current.revision = registryRevision(current);
  await expect(prepareStaticRollback({
    artifactId: first.id,
    version: first.version,
    current,
    outputDirectory: await mkdtemp(join(tmpdir(), "atlas-static-ambiguous-"))
  })).rejects.toThrow(/multiple builds/);
});

test("registry revision is independent of artifact order", () => {
  const host = hostManifest();
  const first = createTestManifest({ id: "first" });
  const second = createTestManifest({ id: "second" });
  const left: AtlasStaticRegistry = { schemaVersion: "1", updatedAt: first.createdAt, hosts: [host], apps: [first, second] };
  const right: AtlasStaticRegistry = { schemaVersion: "1", updatedAt: first.createdAt, hosts: [host], apps: [second, first] };
  expect(registryRevision(left)).toBe(registryRevision(right));
});

function hostManifest(overrides: Partial<AtlasHostManifest> = {}): AtlasHostManifest {
  return {
    schemaVersion: "1",
    kind: "host",
    id: "host",
    name: "Host",
    version: "1.0.0",
    buildId: "host-build",
    channel: "production",
    framework: "react",
    remoteEntryUrl: "https://cdn.example/hosts/host/1.0.0/host-build/remoteEntry.json",
    exposes: { entry: "./host" },
    requiredLoaderApiVersion: "^1.0.0",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}
