import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@jest/globals";
import { createTestManifest } from "../../testkit/dist/index.js";
import { CliArguments } from "../dist/arguments.js";
import { AtlasPublishService } from "../dist/publish.js";
import type { AtlasPublicationLease } from "../dist/publish.js";
import { registryRevision } from "../dist/static-registry.js";
import { DirectoryPublicationStorage, FailingMutableStorage, publicationFixture } from "./publish.driver.js";

test("publisher writes immutable files before activating mutable metadata", async () => {
  const fixture = await publicationFixture();
  const result = await new AtlasPublishService(new CliArguments(["publish"]), fixture.builds).run("orders", {
    config: { storage: new DirectoryPublicationStorage(fixture.storage) }
  });

  expect(result.uploaded).toStrictEqual([
    "apps/orders/1.0.0/build-1/app.manifest.json",
    "apps/orders/1.0.0/build-1/entry.js",
    "registry.json",
    "apps/orders/index.json"
  ]);
  expect(await readFile(join(fixture.storage, "apps/orders/1.0.0/build-1/entry.js"), "utf8")).toBe("export {};\n");
});

test("publisher requires explicit storage for writes", async () => {
  const fixture = await publicationFixture();
  await expect(new AtlasPublishService(new CliArguments(["publish"]), fixture.builds).run("orders")).rejects.toThrow(/Publication storage is required/);
});

test("publisher dry run needs no storage adapter", async () => {
  const fixture = await publicationFixture();
  const result = await new AtlasPublishService(new CliArguments(["publish", "--dry-run"]), fixture.builds).run("orders");
  expect(result.dryRun).toBe(true);
});

test("publisher restores mutable files when deployment verification fails", async () => {
  const fixture = await publicationFixture();
  const previousRegistry = emptyRegistryText();
  await mkdir(fixture.storage, { recursive: true });
  await writeFile(join(fixture.storage, "registry.json"), previousRegistry);

  await expect(new AtlasPublishService(new CliArguments(["publish"]), fixture.builds).run("orders", {
      config: { storage: new DirectoryPublicationStorage(fixture.storage) },
      verify: async () => { throw new Error("smoke test failed"); }
    })).rejects.toThrow(/smoke test failed/);

  expect(await readFile(join(fixture.storage, "registry.json"), "utf8")).toBe(previousRegistry);
  await expect(access(join(fixture.storage, "apps/orders/1.0.0/build-1/entry.js"))).rejects.toMatchObject({ code: "ENOENT" });
});

test("publication config keeps Atlas sequencing and runs CDN invalidation before verification", async () => {
  const fixture = await publicationFixture();
  const events: string[] = [];
  await new AtlasPublishService(new CliArguments(["publish"]), fixture.builds).run("orders", {
    config: {
      storage: () => new DirectoryPublicationStorage(fixture.storage),
      invalidate(paths) { events.push(`invalidate:${paths.join(",")}`); }
    },
    verify: async () => { events.push("verify"); }
  });

  expect(events).toStrictEqual([
    "invalidate:registry.json,apps/orders/index.json",
    "verify"
  ]);
});

test("publisher restores earlier mutable writes when a later mutable write fails", async () => {
  const fixture = await publicationFixture();
  const storage = new FailingMutableStorage("apps/orders/index.json");
  const previousRegistry = emptyRegistryText();
  storage.seed("registry.json", previousRegistry);

  await expect(new AtlasPublishService(new CliArguments(["publish"]), fixture.builds).run("orders", {
    config: { storage }
  })).rejects.toThrow(/simulated write failure/);

  expect(storage.text("registry.json")).toBe(previousRegistry);
  expect(storage.text("apps/orders/index.json")).toBe(undefined);
});

test("rollback selects a stored production build under the same publication lock", async () => {
  const fixture = await publicationFixture();
  const first = createTestManifest({ id: "orders", version: "1.0.0", buildId: "stable" });
  const second = createTestManifest({ id: "orders", version: "2.0.0", buildId: "latest" });
  const registry = {
    schemaVersion: "1" as const,
    updatedAt: second.createdAt,
    hosts: [],
    apps: [first, second],
    selections: { hosts: {}, apps: { orders: { version: "2.0.0", buildId: "latest" } } }
  };
  await mkdir(fixture.storage, { recursive: true });
  await writeFile(join(fixture.storage, "registry.json"), JSON.stringify({
    ...registry,
    revision: registryRevision(registry)
  }));

  const result = await new AtlasPublishService(
    new CliArguments(["rollback", "orders", "--version=1.0.0"]),
    fixture.builds
  ).rollback("orders", "1.0.0", {
    config: { storage: new DirectoryPublicationStorage(fixture.storage) }
  });

  const published = JSON.parse(await readFile(join(fixture.storage, "registry.json"), "utf8"));
  expect(result.buildId).toBe("stable");
  expect(published.selections.apps.orders).toStrictEqual({ version: "1.0.0", buildId: "stable" });
});

test("publisher stops before mutable activation when deployment lease is lost", async () => {
  const fixture = await publicationFixture();
  const storage = new LeaseLossStorage(fixture.storage, 4);

  await expect(new AtlasPublishService(new CliArguments(["publish"]), fixture.builds).run("orders", {
    config: { storage }
  })).rejects.toThrow(/lost its deployment lease/);

  await expect(access(join(fixture.storage, "registry.json"))).rejects.toMatchObject({ code: "ENOENT" });
  await expect(access(join(fixture.storage, "apps/orders/index.json"))).rejects.toMatchObject({ code: "ENOENT" });
});

function emptyRegistryText(): string {
  const registry = {
    schemaVersion: "1" as const,
    updatedAt: "2026-01-01T00:00:00.000Z",
    hosts: [],
    apps: [],
    selections: { hosts: {}, apps: {} }
  };
  return `${JSON.stringify({ ...registry, revision: registryRevision(registry) })}\n`;
}

class LeaseLossStorage extends DirectoryPublicationStorage {
  private assertions = 0;

  constructor(root: string, private readonly failAtAssertion: number) {
    super(root);
  }

  override async acquireLock(): Promise<AtlasPublicationLease> {
    return {
      assertHeld: async () => {
        this.assertions += 1;
        if (this.assertions >= this.failAtAssertion) throw new Error("simulated lease loss");
      },
      release: async () => undefined
    };
  }
}
