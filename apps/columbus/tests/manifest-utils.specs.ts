import { expect, test } from "@jest/globals";
import type { AtlasExtensionManifest } from "../src/contracts.js";
import {
  customManifest,
  selectedManifest,
} from "../src/popup/manifest-utils.js";

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

test.each([
  'https://cdn.example/app',
  'ftp://localhost/app',
  'http://user:secret@localhost/app',
  'http://localhost/app?debug=true',
  'http://localhost/app#debug',
])('custom manifest rejects unsafe base URL %s', (url) => {
  expect(() => customManifest(productionManifest(), url)).toThrow();
});

test('custom manifest accepts a loopback remote entry URL', () => {
  const manifest = customManifest(
    productionManifest(),
    'http://127.0.0.1:4201/remoteEntry.json',
  );

  expect(manifest.remoteEntryUrl).toBe(
    'http://127.0.0.1:4201/remoteEntry.json',
  );
});

test('missing PR selection reports an actionable error', () => {
  const production = productionManifest();

  expect(() =>
    selectedManifest({
      production,
      draft: {
        type: 'pr',
        customUrl: '',
        productionKey: '',
        prKey: '',
      },
      productionOptions: [production],
      prOptions: [],
    }),
  ).toThrow('Choose a PR version.');
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
