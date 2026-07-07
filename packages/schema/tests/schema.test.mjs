import test from "node:test";
import assert from "node:assert/strict";
import {
  AtlasValidationError,
  assertAtlasHostCatalog,
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

test("createManifestFromConfig preserves MF-declared host compatibility", () => {
  const manifest = createManifestFromConfig({
    config: { id: "catalog", framework: "react", hostCompatibility: ["shell", "partner-host.v2"] },
    version: "1.0.0",
    buildId: "build-1",
    remoteEntryUrl: "https://cdn.example.com/catalog/remoteEntry.js"
  });

  assert.deepEqual(manifest.supportedHosts, ["shell", "partner-host.v2"]);
});

test("createManifestFromConfig retains wildcard host compatibility", () => {
  assert.deepEqual(createManifest().supportedHosts, ["*"]);
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
  const issues = validateAtlasManifest(createManifest({ supportedHosts: ["shell", "", "shell", 4] }));

  assert.deepEqual(
    issues.filter((issue) => issue.path.startsWith("supportedHosts.")).map((issue) => issue.path),
    ["supportedHosts.1", "supportedHosts.2", "supportedHosts.3"]
  );
});

test("identifiers permit practical frontend ids", () => {
  const manifest = createManifest({
    id: "workspace.ui_v2",
    supportedHosts: ["shell.web_v2"],
    placements: [{ id: "main-slot_v2", kind: "slot", hostId: "shell.web_v2", slot: "sidebar" }],
    exportedComponents: [{
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
    supportedHosts: ["shell/admin", "shell\\admin", "shell..admin"],
    placements: [{ id: "../main", kind: "route", hostId: "shell/admin", route: { id: "main/route", basePath: "/workspace", title: "Workspace" } }],
    exportedComponents: [{
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

  for (const path of ["id", "supportedHosts.0", "supportedHosts.1", "supportedHosts.2", "placements.0.id", "placements.0.hostId", "placements.0.route.id", "exportedComponents.0.id", "exportedComponents.0.ownerMfId", "uses.0", "uses.1"]) {
    assert.ok(issueAt(issues, path), `Expected an issue at ${path}`);
  }
});

test("catalog host identifiers reject separators and traversal", () => {
  const catalog = { schemaVersion: "1", hostId: "../shell", generatedAt: "2026-01-01T00:00:00.000Z", manifests: [] };

  assert.ok(issueAt(validateAtlasHostCatalog(catalog), "hostId"));
});

test("route placements validate nested route and navigation fields", () => {
  const placements = [{
    id: "main",
    kind: "route",
    hostId: "shell",
    slot: "sidebar",
    route: { id: "main", basePath: "workspace?tab=1", title: "", nav: { label: "", order: "first", visible: "yes" } }
  }];
  const issues = validateAtlasManifest(createManifest({ placements }));

  assert.deepEqual(
    ["placements.0.slot", "placements.0.route.basePath", "placements.0.route.title", "placements.0.route.nav.label", "placements.0.route.nav.order", "placements.0.route.nav.visible"].every((path) => issueAt(issues, path) !== undefined),
    true
  );
});

test("slot placements require a slot and reject route details", () => {
  const placements = [{ id: "tools", kind: "slot", hostId: "shell", route: { id: "tools", basePath: "/tools", title: "Tools" } }];
  const issues = validateAtlasManifest(createManifest({ placements }));

  assert.ok(issueAt(issues, "placements.0.slot"));
  assert.ok(issueAt(issues, "placements.0.route"));
});

test("placements require unique ids", () => {
  const placements = [
    { id: "tools", kind: "slot", hostId: "shell", slot: "sidebar" },
    { id: "tools", kind: "slot", hostId: "shell", slot: "header" }
  ];

  assert.equal(issueAt(validateAtlasManifest(createManifest({ placements })), "placements.1.id")?.message, "Duplicate placement id \"tools\".");
});

test("manifest and nested asset URLs accept only absolute HTTP(S) URLs", () => {
  const exportedComponents = [{
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
    exportedComponents
  }));

  assert.deepEqual(
    ["remoteEntryUrl", "styles.0.href", "exportedComponents.0.remoteEntryUrl"].every((path) => issueAt(issues, path) !== undefined),
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

test("exported components validate metadata and unique ids", () => {
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
  const issues = validateAtlasManifest(createManifest({ exportedComponents: [component, component] }));

  assert.ok(issueAt(issues, "exportedComponents.0.metadata.invalid"));
  assert.ok(issueAt(issues, "exportedComponents.1.id"));
});

test("widget uses reject whitespace and duplicate references", () => {
  const issues = validateAtlasManifest(createManifest({ uses: ["maps/main map", "maps/main", "maps/main"] }));

  assert.ok(issueAt(issues, "uses.0"));
  assert.equal(issueAt(issues, "uses.2")?.message, "Duplicate widget reference \"maps/main\".");
});

test("catalog validates nested manifests with prefixed paths", () => {
  const catalog = { schemaVersion: "1", hostId: "shell", generatedAt: "2026-01-01T00:00:00.000Z", manifests: [createManifest({ version: "latest" })] };

  assert.ok(issueAt(validateAtlasHostCatalog(catalog), "manifests.0.version"));
});

test("catalog rejects duplicate MF ids", () => {
  const catalog = {
    schemaVersion: "1",
    hostId: "shell",
    generatedAt: "2026-01-01T00:00:00.000Z",
    manifests: [createManifest({ id: "catalog" }), createManifest({ id: "catalog" })]
  };

  assert.equal(issueAt(validateAtlasHostCatalog(catalog), "manifests.1.id")?.message, 'Duplicate MF id "catalog".');
});

test("catalog rejects duplicate exact route ownership with a clear owner error", () => {
  const route = { id: "main", kind: "route", hostId: "shell", route: { id: "main", basePath: "/workspace", title: "Workspace" } };
  const catalog = {
    schemaVersion: "1",
    hostId: "shell",
    generatedAt: "2026-01-01T00:00:00.000Z",
    manifests: [createManifest({ id: "first", placements: [route] }), createManifest({ id: "second", placements: [{ ...route, id: "other" }] })]
  };
  const issue = issueAt(validateAtlasHostCatalog(catalog), "manifests.1.placements.0.route.basePath");

  assert.match(issue.message, /already owned by MF "first"/);
  assert.match(issue.message, /manifests\.0\.placements\.0\.route\.basePath/);
});

test("catalog permits the same route path for different hosts", () => {
  const route = { id: "main", kind: "route", route: { id: "main", basePath: "/workspace", title: "Workspace" } };
  const catalog = {
    schemaVersion: "1",
    hostId: "shell",
    generatedAt: "2026-01-01T00:00:00.000Z",
    manifests: [
      createManifest({ id: "first", placements: [{ ...route, hostId: "shell" }] }),
      createManifest({ id: "second", placements: [{ ...route, hostId: "admin" }] })
    ]
  };

  assert.equal(validateAtlasHostCatalog(catalog).length, 0);
});

test("assertAtlasHostCatalog throws structured validation errors", () => {
  assert.throws(
    () => assertAtlasHostCatalog({ schemaVersion: "1", hostId: "shell", generatedAt: "now", manifests: "invalid" }),
    (error) => error instanceof AtlasValidationError && error.issues[0].path === "manifests"
  );
});
