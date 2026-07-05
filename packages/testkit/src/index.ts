import { createManifestFromConfig, type AtlasManifest } from "@atlas/contracts";
import { createAtlasHostSdk, type AtlasHostSdk } from "@atlas/sdk/host";
import { createMemoryNavigation } from "./navigation.js";

export function createTestManifest(overrides: Partial<AtlasManifest> = {}): AtlasManifest {
  return {
    ...createManifestFromConfig({
      config: {
        id: "catalog",
        name: "Catalog",
        framework: "react",
        hostCompatibility: ["shell"],
        placements: [
          {
            id: "catalog-route",
            kind: "route",
            hostId: "shell",
            route: {
              id: "catalog",
              basePath: "/catalog",
              title: "Catalog"
            }
          }
        ]
      },
      version: "1.0.0",
      buildId: "test",
      remoteEntryUrl: "http://localhost:4173/remoteEntry.js",
      createdAt: "2026-01-01T00:00:00.000Z"
    }),
    ...overrides
  };
}

export function createTestHostSdk(hostId = "shell"): AtlasHostSdk {
  return createAtlasHostSdk({
    hostId,
    navigation: createMemoryNavigation()
  });
}

export { createMemoryNavigation } from "./navigation.js";
