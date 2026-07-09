import test from "node:test";
import assert from "node:assert/strict";
import {
  AtlasValidationError,
  assertAtlasHostCatalog,
  assertAtlasManifest,
  createManifestFromConfig,
  validateAtlasHostCatalog,
  validateAtlasManifest
} from "../dist/index.js";

const VALID_INTEGRITY = `sha256-${"A".repeat(43)}=`;

function createManifest(overrides = {}) {
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

function issueAt(issues, path) {
  return issues.find((issue) => issue.path === path);
}

test("createManifestFromConfig derives supported hosts from source routes and slots", () => {
  const manifest = createManifestFromConfig({
    config: {
      id: "catalog",
      framework: "react",
      routes: [{ hostId: "host", basePath: "/catalog", title: "Catalog" }],
      slots: [{ slotId: "sidebar", hostId: "partner-host.v2" }]
    },
    version: "1.0.0",
    buildId: "build-1",
    remoteEntryUrl: "https://cdn.example.com/catalog/remoteEntry.js"
  });

  assert.deepEqual(manifest.supportedHosts, ["host", "partner-host.v2"]);
});

test("createManifestFromConfig uses wildcard supported hosts when no routes or slots are configured", () => {
  assert.deepEqual(createManifest().supportedHosts, ["*"]);
});

test("createManifestFromConfig writes source routes and slots to manifest placements", () => {
  const manifest = createManifestFromConfig({
    config: {
      id: "catalog",
      framework: "react",
      routes: [{ hostId: "host", basePath: "/catalog", title: "Catalog" }],
      slots: [{ slotId: "sidebar", hostId: "host" }]
    },
    version: "1.0.0",
    buildId: "build-1",
    remoteEntryUrl: "https://cdn.example.com/catalog/remoteEntry.js"
  });

  assert.deepEqual(manifest.placements, [
    { id: "host-catalog-route", kind: "route", hostId: "host", route: { basePath: "/catalog", title: "Catalog" } },
    { id: "host-sidebar-slot", kind: "slot", hostId: "host", slot: "sidebar" }
  ]);
});

test("createManifestFromConfig derives unique internal route placement ids", () => {
  const manifest = createManifestFromConfig({
    config: {
      id: "catalog",
      framework: "react",
      routes: [
        { hostId: "host", basePath: "/orders/:id" },
        { hostId: "host", basePath: "/orders/id" }
      ]
    },
    version: "1.0.0",
    buildId: "build-1",
    remoteEntryUrl: "https://cdn.example.com/catalog/remoteEntry.js"
  });

  assert.deepEqual(manifest.placements.map((placement) => placement.id), ["host-orders-id-route", "host-orders-id-route-2"]);
});

test("createManifestFromConfig scopes slot placement ids by host", () => {
  const manifest = createManifestFromConfig({
    config: {
      id: "catalog",
      framework: "react",
      slots: [
        { hostId: "angular-host", slotId: "window" },
        { hostId: "react-host", slotId: "window" }
      ]
    },
    version: "1.0.0",
    buildId: "build-1",
    remoteEntryUrl: "https://cdn.example.com/catalog/remoteEntry.js"
  });

  assert.deepEqual(manifest.placements, [
    { id: "angular-host-window-slot", kind: "slot", hostId: "angular-host", slot: "window" },
    { id: "react-host-window-slot", kind: "slot", hostId: "react-host", slot: "window" }
  ]);
});

test("manifest validates the optional DOM isolation policy", () => {
  assert.equal(issueAt(validateAtlasManifest(createManifest({ isolation: "iframe" })), "isolation")?.path, "isolation");
});

test("manifest reports missing fields", () => {
  const issues = validateAtlasManifest({ id: "broken" });

  assert.ok(issueAt(issues, "remoteEntryUrl"));
  assert.ok(issueAt(issues, "supportedHosts"));
});

test("supported hosts require unique non-empty strings", () => {
  const issues = validateAtlasManifest(createManifest({ supportedHosts: ["host", "", "host", 4] }));

  assert.deepEqual(
    issues.filter((issue) => issue.path.startsWith("supportedHosts.")).map((issue) => issue.path),
    ["supportedHosts.1", "supportedHosts.2", "supportedHosts.3"]
  );
});

test("identifiers permit practical frontend ids", () => {
  const manifest = createManifest({
    id: "workspace.ui_v2",
    supportedHosts: ["host.web_v2"],
    placements: [{ id: "main-slot_v2", kind: "slot", hostId: "host.web_v2", slot: "sidebar" }],
    exportedWidgets: [{
      schemaVersion: "1",
      contractVersion: "1",
      id: "summary-card_v2",
      name: "Summary",
      ownerMfId: "workspace.ui_v2",
      framework: "react",
      remoteEntryUrl: "https://cdn.example/workspace/entry.js",
      expose: "./summary"
    }],
    uses: ["maps.ui_v2/main-map_v2"]
  });

  assert.equal(validateAtlasManifest(manifest).length, 0);
});

test("manifest identifiers reject separators and traversal", () => {
  const issues = validateAtlasManifest(createManifest({
    id: "../workspace",
    supportedHosts: ["host/admin", "host\\admin", "host..admin"],
    placements: [{ id: "../main", kind: "route", hostId: "host/admin", route: { basePath: "/workspace", title: "Workspace" } }],
    exportedWidgets: [{
      schemaVersion: "1",
      contractVersion: "1",
      id: "../summary",
      name: "Summary",
      ownerMfId: "../workspace",
      framework: "react",
      remoteEntryUrl: "https://cdn.example/workspace/entry.js",
      expose: "./summary"
    }],
    uses: ["maps/../main", "maps\\admin/main"]
  }));

  for (const path of ["id", "supportedHosts.0", "supportedHosts.1", "supportedHosts.2", "placements.0.id", "placements.0.hostId", "exportedWidgets.0.id", "exportedWidgets.0.ownerMfId", "uses.0", "uses.1"]) {
    assert.ok(issueAt(issues, path), `Expected an issue at ${path}`);
  }
});

test("catalog host identifiers reject separators and traversal", () => {
  const catalog = { schemaVersion: "1", hostId: "../host", generatedAt: "2026-01-01T00:00:00.000Z", manifests: [] };

  assert.ok(issueAt(validateAtlasHostCatalog(catalog), "hostId"));
});

test("route placements validate nested route and navigation fields", () => {
  const placements = [{
    id: "main",
    kind: "route",
    hostId: "host",
    slot: "sidebar",
    route: { basePath: "workspace?tab=1", title: "", nav: { label: "", order: "first", visible: "yes" } }
  }];
  const issues = validateAtlasManifest(createManifest({ placements }));

  assert.deepEqual(
    ["placements.0.slot", "placements.0.route.basePath", "placements.0.route.title", "placements.0.route.nav.label", "placements.0.route.nav.order", "placements.0.route.nav.visible"].every((path) => issueAt(issues, path) !== undefined),
    true
  );
});

test("slot placements require a slot and reject route details", () => {
  const placements = [{ id: "tools", kind: "slot", hostId: "host", route: { basePath: "/tools", title: "Tools" } }];
  const issues = validateAtlasManifest(createManifest({ placements }));

  assert.ok(issueAt(issues, "placements.0.slot"));
  assert.ok(issueAt(issues, "placements.0.route"));
});

test("placements allow matching ids for different hosts", () => {
  const placements = [
    { id: "window", kind: "slot", hostId: "angular-host", slot: "window" },
    { id: "window", kind: "slot", hostId: "react-host", slot: "window" }
  ];

  assert.equal(issueAt(validateAtlasManifest(createManifest({ placements })), "placements.1.id"), undefined);
});

test("placements require unique ids for each host", () => {
  const placements = [
    { id: "tools", kind: "slot", hostId: "host", slot: "sidebar" },
    { id: "tools", kind: "slot", hostId: "host", slot: "header" }
  ];

  assert.equal(
    issueAt(validateAtlasManifest(createManifest({ placements })), "placements.1.id")?.message,
    "Duplicate mount id \"tools\" for host \"host\". Mount ids only need to be unique within the same host. If this came from atlas.config.ts slots, do not repeat the same slotId for the same hostId; use a different slotId or hostId."
  );
});

test("manifest and nested asset URLs accept only absolute HTTP(S) URLs", () => {
  const exportedWidgets = [{
    schemaVersion: "1",
    contractVersion: "1",
    id: "summary",
    name: "Summary",
    ownerMfId: "workspace",
    framework: "react",
    remoteEntryUrl: "javascript:alert(1)",
    expose: "./summary"
  }];
  const issues = validateAtlasManifest(createManifest({
    remoteEntryUrl: "file:///tmp/entry.js",
    styles: [{ href: "styles.css" }],
    exportedWidgets
  }));

  assert.deepEqual(
    ["remoteEntryUrl", "styles.0.href", "exportedWidgets.0.remoteEntryUrl"].every((path) => issueAt(issues, path) !== undefined),
    true
  );
});

test("manifest versions and host SDK ranges must look semantic", () => {
  const issues = validateAtlasManifest(createManifest({ version: "latest", requiredHostSdkVersion: "next release" }));

  assert.ok(issueAt(issues, "version"));
  assert.ok(issueAt(issues, "requiredHostSdkVersion"));
});

test("host SDK validation permits common extension ranges", () => {
  for (const requiredHostSdkVersion of ["^1.2.3", ">=1.0.0 <2.0.0", "1.x", "*"]) {
    assert.equal(issueAt(validateAtlasManifest(createManifest({ requiredHostSdkVersion })), "requiredHostSdkVersion"), undefined);
  }
});

test("manifest styles require unique URLs and SHA-256 SRI integrity", () => {
  const style = { href: "https://cdn.example/workspace/styles.css", integrity: VALID_INTEGRITY };
  const validManifest = createManifestFromConfig({
    config: { id: "workspace", framework: "react" },
    version: "1.0.0",
    buildId: "build-1",
    remoteEntryUrl: "https://cdn.example/workspace/entry.js",
    styles: [style]
  });

  assert.equal(issueAt(validateAtlasManifest({ ...validManifest, styles: [style, style] }), "styles.1.href")?.message, `Duplicate stylesheet href "${style.href}".`);
  assert.ok(issueAt(validateAtlasManifest({ ...validManifest, styles: [{ ...style, integrity: "sha256-valid" }] }), "styles.0.integrity"));
});

test("manifest integrity requires SHA-256 SRI format", () => {
  assert.ok(issueAt(validateAtlasManifest(createManifest({ integrity: "md5-invalid" })), "integrity"));
  assert.equal(issueAt(validateAtlasManifest(createManifest({ integrity: VALID_INTEGRITY })), "integrity"), undefined);
});

test("exported widgets validate metadata and unique ids", () => {
  const component = {
    schemaVersion: "1",
    contractVersion: "1",
    id: "summary",
    name: "Summary",
    ownerMfId: "workspace",
    framework: "react",
    remoteEntryUrl: "https://cdn.example/workspace/entry.js",
    expose: "./summary",
    metadata: { stable: true, invalid: null }
  };
  const issues = validateAtlasManifest(createManifest({ exportedWidgets: [component, component] }));

  assert.ok(issueAt(issues, "exportedWidgets.0.metadata.invalid"));
  assert.ok(issueAt(issues, "exportedWidgets.1.id"));
});

test("widget uses reject whitespace and duplicate references", () => {
  const issues = validateAtlasManifest(createManifest({ uses: ["maps/main map", "maps/main", "maps/main"] }));

  assert.ok(issueAt(issues, "uses.0"));
  assert.equal(issueAt(issues, "uses.2")?.message, "Duplicate widget reference \"maps/main\".");
});

test("catalog validates nested manifests with prefixed paths", () => {
  const catalog = { schemaVersion: "1", hostId: "host", generatedAt: "2026-01-01T00:00:00.000Z", manifests: [createManifest({ version: "latest" })] };

  assert.ok(issueAt(validateAtlasHostCatalog(catalog), "manifests.0.version"));
});

test("catalog rejects duplicate app ids", () => {
  const catalog = {
    schemaVersion: "1",
    hostId: "host",
    generatedAt: "2026-01-01T00:00:00.000Z",
    manifests: [createManifest({ id: "catalog" }), createManifest({ id: "catalog" })]
  };

  assert.equal(issueAt(validateAtlasHostCatalog(catalog), "manifests.1.id")?.message, 'Duplicate app id "catalog".');
});

test("catalog permits duplicate exact route ownership so runtime can report conflicts", () => {
  const route = { id: "main", kind: "route", hostId: "host", route: { basePath: "/workspace", title: "Workspace" } };
  const catalog = {
    schemaVersion: "1",
    hostId: "host",
    generatedAt: "2026-01-01T00:00:00.000Z",
    manifests: [createManifest({ id: "first", placements: [route] }), createManifest({ id: "second", placements: [{ ...route, id: "other" }] })]
  };

  assert.equal(validateAtlasHostCatalog(catalog).length, 0);
});

test("catalog permits the same route path for different hosts", () => {
  const route = { id: "main", kind: "route", route: { basePath: "/workspace", title: "Workspace" } };
  const catalog = {
    schemaVersion: "1",
    hostId: "host",
    generatedAt: "2026-01-01T00:00:00.000Z",
    manifests: [
      createManifest({ id: "first", placements: [{ ...route, hostId: "host" }] }),
      createManifest({ id: "second", placements: [{ ...route, hostId: "admin" }] })
    ]
  };

  assert.equal(validateAtlasHostCatalog(catalog).length, 0);
});

test("assertAtlasHostCatalog throws structured validation errors", () => {
  assert.throws(
    () => assertAtlasHostCatalog({ schemaVersion: "1", hostId: "host", generatedAt: "now", manifests: "invalid" }),
    (error) => error instanceof AtlasValidationError && error.issues[0].path === "manifests"
  );
});

test("manifest validation error messages include actionable issue details", () => {
  assert.throws(
    () => assertAtlasManifest(createManifest({ placements: [{ id: "tools", kind: "slot", hostId: "host" }] })),
    (error) => error instanceof AtlasValidationError
      && error.message.includes("Invalid Atlas manifest.")
      && error.message.includes("placements.0.slot: Expected slot to be a non-empty string.")
  );
});
