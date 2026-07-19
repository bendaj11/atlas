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
    "apps/orders/1.0.0/build-1/atlas-publication.json",
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
  const storage = new LeaseLossStorage(fixture.storage, 5);

  await expect(new AtlasPublishService(new CliArguments(["publish"]), fixture.builds).run("orders", {
    config: { storage }
  })).rejects.toThrow(/lost its deployment lease/);

  await expect(access(join(fixture.storage, "registry.json"))).rejects.toMatchObject({ code: "ENOENT" });
  await expect(access(join(fixture.storage, "apps/orders/index.json"))).rejects.toMatchObject({ code: "ENOENT" });
});

test("publisher skips a PR build when the provider head moved", async () => {
  const fixture = await publicationFixture();
  const original = await fixture.builds.build("orders");
  const builds = {
    async build() {
      return {
        ...original,
        manifest: { ...original.manifest, channel: "pr" as const, prNumber: 42, gitSha: "old-sha" }
      };
    }
  };

  const result = await new AtlasPublishService(new CliArguments(["publish"]), builds).run("orders", {
    config: {
      storage: new DirectoryPublicationStorage(fixture.storage),
      resolvePullRequest: async () => ({ state: "open", headSha: "new-sha" })
    }
  });

  expect(result.skippedReason).toMatch(/moved from commit old-sha to new-sha/);
  await expect(access(join(fixture.storage, "registry.json"))).rejects.toMatchObject({ code: "ENOENT" });
});

test("publisher keeps only the latest successful build for one artifact and PR", async () => {
  const fixture = await publicationFixture();
  const original = await fixture.builds.build("orders");
  const firstManifest = {
    ...original.manifest,
    version: "1.0.0-pr.42",
    buildId: "first",
    channel: "pr" as const,
    prNumber: 42,
    gitSha: "first-sha"
  };
  const storage = new DirectoryPublicationStorage(fixture.storage);
  const firstBuilds = { async build() { return { ...original, manifest: firstManifest }; } };
  await new AtlasPublishService(new CliArguments(["publish"]), firstBuilds).run("orders", {
    config: { storage, resolvePullRequest: async () => ({ state: "open", headSha: "first-sha" }) }
  });

  const secondManifest = { ...firstManifest, buildId: "second", gitSha: "second-sha" };
  const secondBuilds = { async build() { return { ...original, manifest: secondManifest }; } };
  const result = await new AtlasPublishService(new CliArguments(["publish"]), secondBuilds).run("orders", {
    config: { storage, resolvePullRequest: async () => ({ state: "open", headSha: "second-sha" }) }
  });

  const registry = JSON.parse(await readFile(join(fixture.storage, "registry.json"), "utf8"));
  expect(registry.apps.map(({ buildId }: { buildId: string }) => buildId)).toStrictEqual(["second"]);
  expect(result.cleanupWarnings).toStrictEqual([]);
  await expect(access(join(fixture.storage, "apps/orders/1.0.0-pr.42/first/entry.js"))).rejects.toMatchObject({ code: "ENOENT" });
  await expect(access(join(fixture.storage, "apps/orders/1.0.0-pr.42/second/entry.js"))).resolves.toBeUndefined();
});

test("remove-pr removes matching registry entries and their inventory-listed objects", async () => {
  const fixture = await publicationFixture();
  const original = await fixture.builds.build("orders");
  const manifest = {
    ...original.manifest,
    version: "1.0.0-pr.12",
    buildId: "preview",
    channel: "pr" as const,
    prNumber: 12,
    gitSha: "preview-sha"
  };
  const builds = { async build() { return { ...original, manifest }; } };
  const storage = new DirectoryPublicationStorage(fixture.storage);
  await new AtlasPublishService(new CliArguments(["publish"]), builds).run("orders", {
    config: { storage, resolvePullRequest: async () => ({ state: "open", headSha: "preview-sha" }) }
  });

  const result = await new AtlasPublishService(new CliArguments(["remove-pr"]), builds)
    .removePr(["orders"], 12, { config: { storage } });

  const registry = JSON.parse(await readFile(join(fixture.storage, "registry.json"), "utf8"));
  expect(result.removedBuilds).toBe(1);
  expect(registry.apps).toStrictEqual([]);
  await expect(access(join(fixture.storage, "apps/orders/1.0.0-pr.12/preview/entry.js"))).rejects.toMatchObject({ code: "ENOENT" });
});

test("prune-prs preserves open PRs and removes PRs missing from an authoritative state file", async () => {
  const fixture = await publicationFixture();
  const original = await fixture.builds.build("orders");
  const manifest = {
    ...original.manifest,
    version: "1.0.0-pr.19",
    buildId: "preview",
    channel: "pr" as const,
    prNumber: 19,
    gitSha: "preview-sha"
  };
  const builds = { async build() { return { ...original, manifest }; } };
  const storage = new DirectoryPublicationStorage(fixture.storage);
  await new AtlasPublishService(new CliArguments(["publish"]), builds).run("orders", {
    config: { storage, resolvePullRequest: async () => ({ state: "open", headSha: "preview-sha" }) }
  });

  const service = new AtlasPublishService(new CliArguments(["prune-prs"]), builds);
  const preserved = await service.prunePrs(["orders"], new Set([19]), { config: { storage } });
  const removed = await service.prunePrs(["orders"], new Set(), { config: { storage } });

  expect(preserved.removedBuilds).toBe(0);
  expect(removed.removedBuilds).toBe(1);
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
