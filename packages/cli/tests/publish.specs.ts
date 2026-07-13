import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "@jest/globals";
import { CliArguments } from "../dist/arguments.js";
import { AtlasPublishService, FileSystemPublicationStorage } from "../dist/publish.js";
import { registryRevision } from "../dist/static-registry.js";
import { FailingMutableStorage, publicationFixture } from "./publish.driver.js";

test("publisher writes immutable files before activating mutable metadata", async () => {
  const fixture = await publicationFixture(registryRevision(undefined));
  const result = await new AtlasPublishService(new CliArguments([
    "publish", `--storage-directory=${fixture.storage}`
  ])).run(fixture.plan);

  assert.deepEqual(result.uploaded, [
    "apps/orders/1.0.0/build-1/entry.js",
    "registry.json",
    "apps/orders/index.json",
    "hosts/customer-host/catalog.json"
  ]);
  assert.equal(await readFile(join(fixture.storage, "apps/orders/1.0.0/build-1/entry.js"), "utf8"), "export {};\n");
});

test("publisher restores mutable files when deployment verification fails", async () => {
  const fixture = await publicationFixture("sha256:live");
  const previousRegistry = '{"schemaVersion":"1","revision":"sha256:live"}\n';
  const previousCatalog = '{"revision":"sha256:previous"}\n';
  await mkdir(join(fixture.storage, "hosts/customer-host"), { recursive: true });
  await writeFile(join(fixture.storage, "registry.json"), previousRegistry);
  await writeFile(join(fixture.storage, "hosts/customer-host/catalog.json"), previousCatalog);

  await assert.rejects(
    new AtlasPublishService(new CliArguments(["publish", `--storage-directory=${fixture.storage}`])).run(fixture.plan, {
      verify: async () => { throw new Error("smoke test failed"); }
    }),
    /smoke test failed/
  );

  assert.equal(await readFile(join(fixture.storage, "registry.json"), "utf8"), previousRegistry);
  assert.equal(await readFile(join(fixture.storage, "hosts/customer-host/catalog.json"), "utf8"), previousCatalog);
  assert.equal(await readFile(join(fixture.storage, "apps/orders/1.0.0/build-1/entry.js"), "utf8"), "export {};\n");
});

test("advanced publish config keeps Atlas sequencing and runs CDN invalidation before verification", async () => {
  const fixture = await publicationFixture(registryRevision(undefined));
  const events: string[] = [];
  await new AtlasPublishService(new CliArguments(["publish"])).run(fixture.plan, {
    config: {
      storage: () => new FileSystemPublicationStorage(fixture.storage),
      invalidate(paths) { events.push(`invalidate:${paths.join(",")}`); }
    },
    verify: async () => { events.push("verify"); }
  });

  assert.deepEqual(events, [
    "invalidate:registry.json,apps/orders/index.json,hosts/customer-host/catalog.json",
    "verify"
  ]);
});

test("publisher restores earlier mutable writes when a later mutable write fails", async () => {
  const fixture = await publicationFixture("sha256:live");
  const storage = new FailingMutableStorage("apps/orders/index.json");
  const previousRegistry = '{"schemaVersion":"1","revision":"sha256:live"}\n';
  storage.seed("registry.json", previousRegistry);

  await assert.rejects(new AtlasPublishService(new CliArguments(["publish"])).run(fixture.plan, {
    config: { storage }
  }), /simulated write failure/);

  assert.equal(storage.text("registry.json"), previousRegistry);
  assert.equal(storage.text("apps/orders/index.json"), undefined);
  assert.equal(storage.text("hosts/customer-host/catalog.json"), undefined);
});
