import { expect, test } from "@jest/globals";
import type { AtlasExtensionManifest, AtlasHostData } from "../src/contracts.js";
import { uniqueVersions } from "../src/manifest-versions.js";
import { productionVersions, versionLabel } from "../src/popup/manifest-utils.js";

test("release history sorts production, PR, then local builds", () => {
  const production = manifest({ channel: "production", buildId: "production", createdAt: "2026-01-01T00:00:00.000Z" });
  const pullRequest = manifest({ channel: "pr", version: "1.0.0-pr.42", buildId: "pull-request", prNumber: 42 });
  const local = manifest({ channel: "local", buildId: "local" });

  expect(uniqueVersions([local, pullRequest, production]).map(({ channel }) => channel))
    .toStrictEqual(["production", "pr", "local"]);
});

test("current production remains first when same version has multiple builds", () => {
  const current = manifest({ buildId: "current-build", createdAt: "2026-01-01T00:00:00.000Z" });
  const newerHistorical = manifest({ buildId: "historical-build", createdAt: "2026-02-01T00:00:00.000Z" });
  const hostData = hostDataWithVersions(current, [newerHistorical, current]);

  expect(productionVersions(hostData, current).map(({ buildId }) => buildId))
    .toStrictEqual(["current-build", "historical-build"]);
});

test("release labels distinguish builds sharing one version", () => {
  expect(versionLabel(manifest({ version: "1.2.3", buildId: "abcdef123456" })))
    .toBe("1.2.3 · abcdef1");
});

function manifest(overrides: Partial<AtlasExtensionManifest>): AtlasExtensionManifest {
  return {
    schemaVersion: "1",
    kind: "app",
    id: "orders",
    name: "Orders",
    version: "1.0.0",
    buildId: "build",
    channel: "production",
    framework: "react",
    remoteEntryUrl: "https://cdn.example/remoteEntry.json",
    ...overrides
  };
}

function hostDataWithVersions(
  current: AtlasExtensionManifest,
  versions: AtlasExtensionManifest[]
): AtlasHostData {
  const host = { ...current, kind: "host" as const, id: "host", name: "Host" };
  return {
    config: { schemaVersion: "1", hostId: "host", catalogUrl: "https://cdn.example/hosts/host/catalog.json" },
    pageUrl: "https://portal.example/orders",
    catalog: { schemaVersion: "1", hostId: "host", revision: "sha256:test", host, apps: [current] },
    versions: { "app:orders": versions },
    overrides: undefined,
    overrideScope: undefined,
    runtimeErrors: [],
    versionErrors: []
  };
}
