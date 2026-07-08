import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { prepareStaticRegistry, prepareStaticRollback, registryRevision } from "../dist/static-registry.js";
import { createTestManifest } from "../../testkit/dist/index.js";

test("static registry prepares version indexes and a host catalog", async () => {
  const directory = await mkdtemp(join(tmpdir(), "atlas-static-registry-"));
  const widget = {
    schemaVersion: "1",
    id: "summary",
    name: "Summary",
    ownerMfId: "orders",
    framework: "angular",
    remoteEntryUrl: "https://cdn.example/orders/1.0.0/build/remoteEntry.json",
    expose: "./components/summary",
    contractVersion: "1"
  };
  const owner = createTestManifest({ id: "orders", name: "Orders", exportedComponents: [widget] });
  const consumer = createTestManifest({ id: "dashboard", name: "Dashboard", uses: ["orders/summary"] });

  await prepareStaticRegistry(owner, undefined, directory);
  const current = await readJson(join(directory, "registry.json"));
  await prepareStaticRegistry(consumer, current, directory);

  const index = await readJson(join(directory, "microfrontends/orders/index.json"));
  const catalog = await readJson(join(directory, "hosts/host/catalog.json"));
  assert.deepEqual(index.manifests.map((manifest) => manifest.id), ["orders"]);
  assert.deepEqual(catalog.manifests.map((manifest) => manifest.id), ["dashboard", "orders"]);
});

test("static registry rejects IDs that could escape the output directory", async () => {
  const directory = await mkdtemp(join(tmpdir(), "atlas-static-containment-"));
  const manifest = {
    ...createTestManifest(),
    supportedHosts: ["../outside"],
    placements: []
  };
  await assert.rejects(prepareStaticRegistry(manifest, undefined, directory), /Invalid Atlas manifest|safe path segment/);
});

test("static registry preserves history while selecting one production version", async () => {
  const directory = await mkdtemp(join(tmpdir(), "atlas-static-history-"));
  await prepareStaticRegistry(createTestManifest({ version: "1.0.0", buildId: "one" }), undefined, directory);
  let current = await readJson(join(directory, "registry.json"));
  await prepareStaticRegistry(createTestManifest({ version: "2.0.0", buildId: "two" }), current, directory);
  current = await readJson(join(directory, "registry.json"));
  await prepareStaticRegistry(createTestManifest({ version: "2.0.0-pr.42", buildId: "pr", channel: "pr", prNumber: 42 }), current, directory);

  const index = await readJson(join(directory, "microfrontends/catalog/index.json"));
  const catalog = await readJson(join(directory, "hosts/host/catalog.json"));
  assert.equal(index.manifests.length, 3);
  assert.equal(catalog.manifests.length, 1);
  assert.equal(catalog.manifests[0].version, "2.0.0");
});

test("static rollback selects an immutable historical production build", async () => {
  const directory = await mkdtemp(join(tmpdir(), "atlas-static-rollback-"));
  const first = createTestManifest({ version: "1.0.0", buildId: "one" });
  const second = createTestManifest({ version: "2.0.0", buildId: "two" });
  await prepareStaticRegistry(first, undefined, directory);
  let current = await readJson(join(directory, "registry.json"));
  await prepareStaticRegistry(second, current, directory);
  current = await readJson(join(directory, "registry.json"));

  const result = await prepareStaticRollback({
    mfId: first.id,
    version: first.version,
    current,
    outputDirectory: directory,
    updatedAt: "2026-02-01T00:00:00.000Z"
  });

  const registry = await readJson(join(directory, "registry.json"));
  const catalog = await readJson(join(directory, "hosts/host/catalog.json"));
  assert.equal(result.selected.buildId, "one");
  assert.equal(registry.manifests.length, 2);
  assert.deepEqual(registry.productionSelections[first.id], { version: "1.0.0", buildId: "one" });
  assert.equal(catalog.manifests[0].version, "1.0.0");
});

test("static rollback requires a build id when a version has multiple builds", async () => {
  const directory = await mkdtemp(join(tmpdir(), "atlas-static-ambiguous-"));
  const first = createTestManifest({ version: "1.0.0", buildId: "one" });
  const rebuilt = createTestManifest({ version: "1.0.0", buildId: "two" });
  const current = {
    schemaVersion: "1",
    updatedAt: first.createdAt,
    manifests: [first, rebuilt]
  };
  await assert.rejects(
    prepareStaticRollback({ mfId: first.id, version: first.version, current, outputDirectory: directory }),
    /multiple builds/
  );
});

test("registry revision is independent of manifest and object key order", () => {
  const first = createTestManifest({ id: "first" });
  const second = createTestManifest({ id: "second" });
  const reorderedFirst = Object.fromEntries(Object.entries(first).reverse());
  assert.equal(registryRevision([first, second]), registryRevision([second, reorderedFirst]));
});

test("static registry rejects content that does not match its declared revision", async () => {
  const directory = await mkdtemp(join(tmpdir(), "atlas-invalid-revision-"));
  const manifest = createTestManifest();
  const current = {
    schemaVersion: "1",
    revision: registryRevision([manifest]),
    updatedAt: manifest.createdAt,
    manifests: [{ ...manifest, version: "9.9.9" }]
  };
  await assert.rejects(
    prepareStaticRegistry(createTestManifest({ buildId: "next" }), current, directory),
    /registry revision is invalid/
  );
});

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}
