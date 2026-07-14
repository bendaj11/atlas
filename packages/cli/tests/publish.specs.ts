import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@jest/globals";
import { CliArguments } from "../dist/arguments.js";
import { AtlasPublishService } from "../dist/publish.js";
import { registryRevision } from "../dist/static-registry.js";
import { DirectoryPublicationStorage, FailingMutableStorage, publicationFixture } from "./publish.driver.js";

test("publisher writes immutable files before activating mutable metadata", async () => {
  const fixture = await publicationFixture(registryRevision(undefined));
  const result = await new AtlasPublishService(new CliArguments(["publish"])).run(fixture.plan, {
    config: { storage: new DirectoryPublicationStorage(fixture.storage) }
  });

  expect(result.uploaded).toStrictEqual([
    "apps/orders/1.0.0/build-1/entry.js",
    "registry.json",
    "apps/orders/index.json",
    "hosts/customer-host/catalog.json"
  ]);
  expect(await readFile(join(fixture.storage, "apps/orders/1.0.0/build-1/entry.js"), "utf8")).toBe("export {};\n");
});

test("publisher requires explicit storage for writes", async () => {
  const fixture = await publicationFixture(registryRevision(undefined));
  await expect(new AtlasPublishService(new CliArguments(["publish"])).run(fixture.plan)).rejects.toThrow(/Publication storage is required/);
});

test("publisher dry run needs no storage adapter", async () => {
  const fixture = await publicationFixture(registryRevision(undefined));
  const result = await new AtlasPublishService(new CliArguments(["publish", "--dry-run"])).run(fixture.plan);
  expect(result.dryRun).toBe(true);
});

test("publisher restores mutable files when deployment verification fails", async () => {
  const fixture = await publicationFixture("sha256:live");
  const previousRegistry = '{"schemaVersion":"1","revision":"sha256:live"}\n';
  const previousCatalog = '{"revision":"sha256:previous"}\n';
  await mkdir(join(fixture.storage, "hosts/customer-host"), { recursive: true });
  await writeFile(join(fixture.storage, "registry.json"), previousRegistry);
  await writeFile(join(fixture.storage, "hosts/customer-host/catalog.json"), previousCatalog);

  await expect(new AtlasPublishService(new CliArguments(["publish"])).run(fixture.plan, {
      config: { storage: new DirectoryPublicationStorage(fixture.storage) },
      verify: async () => { throw new Error("smoke test failed"); }
    })).rejects.toThrow(/smoke test failed/);

  expect(await readFile(join(fixture.storage, "registry.json"), "utf8")).toBe(previousRegistry);
  expect(await readFile(join(fixture.storage, "hosts/customer-host/catalog.json"), "utf8")).toBe(previousCatalog);
  expect(await readFile(join(fixture.storage, "apps/orders/1.0.0/build-1/entry.js"), "utf8")).toBe("export {};\n");
});

test("publication config keeps Atlas sequencing and runs CDN invalidation before verification", async () => {
  const fixture = await publicationFixture(registryRevision(undefined));
  const events: string[] = [];
  await new AtlasPublishService(new CliArguments(["publish"])).run(fixture.plan, {
    config: {
      storage: () => new DirectoryPublicationStorage(fixture.storage),
      invalidate(paths) { events.push(`invalidate:${paths.join(",")}`); }
    },
    verify: async () => { events.push("verify"); }
  });

  expect(events).toStrictEqual([
    "invalidate:registry.json,apps/orders/index.json,hosts/customer-host/catalog.json",
    "verify"
  ]);
});

test("publisher restores earlier mutable writes when a later mutable write fails", async () => {
  const fixture = await publicationFixture("sha256:live");
  const storage = new FailingMutableStorage("apps/orders/index.json");
  const previousRegistry = '{"schemaVersion":"1","revision":"sha256:live"}\n';
  storage.seed("registry.json", previousRegistry);

  await expect(new AtlasPublishService(new CliArguments(["publish"])).run(fixture.plan, {
    config: { storage }
  })).rejects.toThrow(/simulated write failure/);

  expect(storage.text("registry.json")).toBe(previousRegistry);
  expect(storage.text("apps/orders/index.json")).toBe(undefined);
  expect(storage.text("hosts/customer-host/catalog.json")).toBe(undefined);
});
