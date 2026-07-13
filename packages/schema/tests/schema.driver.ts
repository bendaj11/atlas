import { createManifestFromConfig, type AtlasHostCatalog, type AtlasHostManifest, type AtlasManifest, type AtlasValidationIssue } from "../dist/index.js";

export const VALID_INTEGRITY = `sha256-${"A".repeat(43)}=`;

export function createManifest(overrides: Partial<AtlasManifest> = {}): AtlasManifest {
  return {
    ...createManifestFromConfig({
      config: { id: "workspace", framework: "react" },
      version: "1.0.0",
      buildId: "build-1",
      remoteEntryUrl: "https://cdn.example/workspace/entry.js",
      createdAt: "2026-01-01T00:00:00.000Z"
    }),
    ...overrides
  };
}

export function issueAt(issues: AtlasValidationIssue[], path: string): AtlasValidationIssue | undefined {
  return issues.find((issue) => issue.path === path);
}

export function createManifestCandidate(overrides: Record<string, unknown>): unknown {
  return { ...createManifest(), ...overrides };
}

export function createCatalog(apps: AtlasManifest[] = [], hostId = "host"): AtlasHostCatalog {
  return {
    schemaVersion: "1",
    hostId,
    revision: "sha256:test",
    generatedAt: "2026-01-01T00:00:00.000Z",
    host: createHostManifest(hostId),
    apps
  };
}

export function createHostManifest(id = "host"): AtlasHostManifest {
  return {
    schemaVersion: "1",
    kind: "host",
    id,
    name: id,
    version: "1.0.0",
    buildId: "build-1",
    channel: "production",
    framework: "react",
    remoteEntryUrl: "https://cdn.example/hosts/host/remoteEntry.json",
    exposes: { entry: "./host" },
    requiredLoaderApiVersion: "^1.0.0",
    createdAt: "2026-01-01T00:00:00.000Z"
  };
}
