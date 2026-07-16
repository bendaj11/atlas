import { test } from "@jest/globals";
import assert from "node:assert/strict";
import {
  AtlasValidationError,
  assertAtlasHostCatalog,
  assertAtlasManifest,
  createManifestFromConfig,
  ensureActionableError,
  validateAtlasHostCatalog,
  validateAtlasManifest
} from "../dist/index.js";
import type { AtlasPlacement } from "../dist/index.js";
import { VALID_INTEGRITY, createCatalog, createManifest, createManifestCandidate, issueAt } from "./schema.driver.js";

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

test("route base paths must be unique for each host", () => {
  const placements: AtlasPlacement[] = [
    { id: "orders-route", kind: "route", hostId: "host", route: { basePath: "/orders", title: "Orders" } },
    { id: "more-orders-route", kind: "route", hostId: "host", route: { basePath: "/orders/", title: "More Orders" } }
  ];

  assert.equal(
    issueAt(validateAtlasManifest(createManifest({ placements })), "placements.1.route.basePath")?.message,
    "Duplicate route basePath \"/orders\" for host \"host\". In atlas.config.ts routes, each hostId can use a basePath only once. Use a different basePath or hostId."
  );
});

test("route base paths can match across different hosts", () => {
  const placements: AtlasPlacement[] = [
    { id: "customer-orders-route", kind: "route", hostId: "customer-host", route: { basePath: "/orders", title: "Orders" } },
    { id: "admin-orders-route", kind: "route", hostId: "admin-host", route: { basePath: "/orders", title: "Orders" } }
  ];

  assert.equal(issueAt(validateAtlasManifest(createManifest({ placements })), "placements.1.route.basePath"), undefined);
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
  assert.equal(issueAt(validateAtlasManifest(createManifestCandidate({ isolation: "iframe" })), "isolation")?.path, "isolation");
});

test("manifest reports missing fields", () => {
  const issues = validateAtlasManifest({ id: "broken" });

  assert.ok(issueAt(issues, "remoteEntryUrl"));
  assert.ok(issueAt(issues, "supportedHosts"));
});

test("supported hosts require unique non-empty strings", () => {
  const issues = validateAtlasManifest(createManifestCandidate({ supportedHosts: ["host", "", "host", 4] }));

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
      ownerAppId: "workspace.ui_v2",
      framework: "react",
      remoteEntryUrl: "https://cdn.example/workspace/entry.js",
      expose: "./summary"
    }],
    externalAppsDependencies: ["maps.ui_v2"]
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
      ownerAppId: "../workspace",
      framework: "react",
      remoteEntryUrl: "https://cdn.example/workspace/entry.js",
      expose: "./summary"
    }],
    externalAppsDependencies: ["maps/admin", "maps\\admin"]
  }));

  for (const path of ["id", "supportedHosts.0", "supportedHosts.1", "supportedHosts.2", "placements.0.id", "placements.0.hostId", "exportedWidgets.0.id", "exportedWidgets.0.ownerAppId", "externalAppsDependencies.0", "externalAppsDependencies.1"]) {
    assert.ok(issueAt(issues, path), `Expected an issue at ${path}`);
  }
});

test("catalog host identifiers reject separators and traversal", () => {
  const catalog = createCatalog([], "../host");

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
  const issues = validateAtlasManifest(createManifestCandidate({ placements }));

  assert.deepEqual(
    ["placements.0.slot", "placements.0.route.basePath", "placements.0.route.title", "placements.0.route.nav.label", "placements.0.route.nav.order", "placements.0.route.nav.visible"].every((path) => issueAt(issues, path) !== undefined),
    true
  );
});

test("slot placements require a slot and reject route details", () => {
  const placements = [{ id: "tools", kind: "slot", hostId: "host", route: { basePath: "/tools", title: "Tools" } }];
  const issues = validateAtlasManifest(createManifestCandidate({ placements }));

  assert.ok(issueAt(issues, "placements.0.slot"));
  assert.ok(issueAt(issues, "placements.0.route"));
});

test("placements allow matching ids for different hosts", () => {
  const placements: AtlasPlacement[] = [
    { id: "window", kind: "slot", hostId: "angular-host", slot: "window" },
    { id: "window", kind: "slot", hostId: "react-host", slot: "window" }
  ];

  assert.equal(issueAt(validateAtlasManifest(createManifest({ placements })), "placements.1.id"), undefined);
});

test("placements require unique ids for each host", () => {
  const placements: AtlasPlacement[] = [
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
    ownerAppId: "workspace",
    framework: "react",
    remoteEntryUrl: "javascript:alert(1)",
    expose: "./summary"
  }];
  const issues = validateAtlasManifest(createManifestCandidate({
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
    ownerAppId: "workspace",
    framework: "react",
    remoteEntryUrl: "https://cdn.example/workspace/entry.js",
    expose: "./summary",
    metadata: { stable: true, invalid: null }
  };
  const issues = validateAtlasManifest(createManifestCandidate({ exportedWidgets: [component, component] }));

  assert.ok(issueAt(issues, "exportedWidgets.0.metadata.invalid"));
  assert.ok(issueAt(issues, "exportedWidgets.1.id"));
});

test("external app dependencies reject whitespace and duplicate ids", () => {
  const issues = validateAtlasManifest(createManifest({ externalAppsDependencies: ["maps app", "maps", "maps"] }));

  assert.ok(issueAt(issues, "externalAppsDependencies.0"));
  assert.equal(issueAt(issues, "externalAppsDependencies.2")?.message, "Duplicate external app dependency \"maps\".");
});

test("catalog validates nested manifests with prefixed paths", () => {
  const catalog = createCatalog([createManifest({ version: "latest" })]);

  assert.ok(issueAt(validateAtlasHostCatalog(catalog), "apps.0.version"));
});

test("catalog rejects duplicate app ids", () => {
  const catalog = createCatalog([createManifest({ id: "catalog" }), createManifest({ id: "catalog" })]);

  assert.equal(issueAt(validateAtlasHostCatalog(catalog), "apps.1.id")?.message, 'Duplicate app id "catalog".');
});

test("catalog permits duplicate exact route ownership so runtime can report conflicts", () => {
  const route: AtlasPlacement = { id: "main", kind: "route", hostId: "host", route: { basePath: "/workspace", title: "Workspace" } };
  const catalog = createCatalog([createManifest({ id: "first", placements: [route] }), createManifest({ id: "second", placements: [{ ...route, id: "other" }] })]);

  assert.equal(validateAtlasHostCatalog(catalog).length, 0);
});

test("catalog permits the same route path for different hosts", () => {
  const catalog = createCatalog([
      createManifest({ id: "first", placements: [{ id: "main", kind: "route", hostId: "host", route: { basePath: "/workspace", title: "Workspace" } }] }),
      createManifest({ id: "second", placements: [{ id: "main", kind: "route", hostId: "admin", route: { basePath: "/workspace", title: "Workspace" } }] })
  ]);

  assert.equal(validateAtlasHostCatalog(catalog).length, 0);
});

test("assertAtlasHostCatalog throws structured validation errors", () => {
  assert.throws(
    () => assertAtlasHostCatalog({ ...createCatalog(), apps: "invalid" }),
    (error) => error instanceof AtlasValidationError && error.issues.some(({ path }) => path === "apps")
  );
});

test("manifest validation error messages include actionable issue details", () => {
  assert.throws(
    () => assertAtlasManifest(createManifest({ placements: [{ id: "tools", kind: "slot", hostId: "host" }] })),
    (error) => error instanceof AtlasValidationError
      && error.message.includes("Invalid Atlas manifest.")
      && error.message.includes("placements.0.slot: Expected slot to be a non-empty string.")
      && error.message.includes("Suggested action:")
  );
});

test("Atlas errors preserve details and always include one suggested action", () => {
  const error = new Error("Catalog request returned 503.");

  assert.equal(ensureActionableError(error), error);
  assert.match(error.message, /Catalog request returned 503\./);
  assert.match(error.message, /Suggested action: Verify configured catalog URL/);
  assert.equal(error.message.match(/Suggested action:/g)?.length, 1);
  ensureActionableError(error);
  assert.equal(error.message.match(/Suggested action:/g)?.length, 1);
});

test("missing Atlas project configuration has a precise suggested action", () => {
  const error = ensureActionableError(new Error(
    'Atlas project "react-host" is missing required configuration file "apps/react-host/atlas.config.ts".'
  ));

  assert.match(error.message, /Restore or create atlas\.config\.ts in the named project/);
});
