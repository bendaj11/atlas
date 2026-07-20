import { expect, test } from "@jest/globals";
import type { AtlasExtensionManifest } from "../src/contracts.js";
import { customManifest } from "../src/popup/manifest-utils.js";

test("custom Angular manifest uses local development assets and removes production integrity", () => {
  const manifest = customManifest(productionManifest(), "http://localhost:4201/");

  expect(manifest).toMatchObject({
    channel: "local",
    remoteEntryUrl: "http://localhost:4201/remoteEntry.json",
    styles: [{ href: "http://localhost:4201/styles.css" }],
    exportedWidgets: [{ remoteEntryUrl: "http://localhost:4201/remoteEntry.json" }]
  });
  expect(manifest.integrity).toBeUndefined();
});

test("custom React manifest does not copy production styles", () => {
  const production = productionManifest();
  production.framework = "react";

  expect(customManifest(production, "http://localhost:4201").styles).toStrictEqual([]);
});

function productionManifest(): AtlasExtensionManifest {
  return {
    schemaVersion: "1",
    kind: "app",
    id: "app",
    name: "App",
    version: "1.0.0",
    buildId: "production",
    channel: "production",
    framework: "angular",
    remoteEntryUrl: "https://cdn.example/apps/app/1.0.0/production/remoteEntry.json",
    integrity: "sha256-production",
    styles: [{
      href: "https://cdn.example/apps/app/1.0.0/production/assets/app.css",
      integrity: "sha256-production-style"
    }],
    exportedWidgets: [{
      remoteEntryUrl: "https://cdn.example/apps/app/1.0.0/production/widgets/summary.js"
    }]
  };
}
