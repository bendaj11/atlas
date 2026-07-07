import test from "node:test";
import assert from "node:assert/strict";
import { ATLAS_OVERRIDE_DOCUMENT_STORAGE_KEY, AtlasLoadError, createComponentLoader, createHostUi, createNativeFederationImporters, createRemoteTrustPolicy, createTrustedNativeFederationImporters, createWidgetLoader, loadBrowserRuntimeOverrides, loadHostCatalog, loadHostRuntimeConfig, mountMicrofrontend, resolveRuntimeManifests, runResiliently, startAtlasHostRuntime, verifyManifestIntegrity } from "../dist/index.js";
import { createTestHostSdk, createTestManifest } from "../../testkit/dist/index.js";

test("resolveRuntimeManifests rejects duplicate selected MF versions", () => {
  const catalog = {
    schemaVersion: "1",
    hostId: "shell",
    generatedAt: "2026-01-01T00:00:00.000Z",
    manifests: [
      createTestManifest({ version: "1.0.0" }),
      createTestManifest({ version: "2.0.0" })
    ]
  };

  assert.throws(() => resolveRuntimeManifests(catalog), /multiple selected versions/);
});

test("resolveRuntimeManifests applies overrides", () => {
  const production = createTestManifest({ version: "1.0.0", channel: "production" });
  const local = createTestManifest({ id: "catalog", version: "2.0.0", channel: "local", remoteEntryUrl: "http://localhost:4201/remoteEntry.json" });
  const catalog = {
    schemaVersion: "1",
    hostId: "shell",
    generatedAt: "2026-01-01T00:00:00.000Z",
    manifests: [production]
  };

  const manifests = resolveRuntimeManifests(catalog, [{ mfId: "catalog", manifest: local, reason: "local" }]);

  assert.equal(manifests[0].version, "2.0.0");
});

test("resolveRuntimeManifests treats wildcard supportedHosts as universal", () => {
  const manifest = createTestManifest({ supportedHosts: ["*"] });
  const catalog = { schemaVersion: "1", hostId: "partner-host", generatedAt: "now", manifests: [manifest] };

  assert.deepEqual(resolveRuntimeManifests(catalog), [manifest]);
});

test("resolveRuntimeManifests rejects unknown, duplicate, and host-incompatible overrides", () => {
  const selected = createTestManifest({ id: "catalog" });
  const catalog = { schemaVersion: "1", hostId: "shell", generatedAt: "now", manifests: [selected] };
  const replacement = createTestManifest({ id: "catalog", version: "2.0.0" });

  assert.throws(
    () => resolveRuntimeManifests(catalog, [{ mfId: "unknown", manifest: createTestManifest({ id: "unknown" }), reason: "local" }]),
    /not selected by the host catalog/
  );
  assert.throws(
    () => resolveRuntimeManifests(catalog, [
      { mfId: "catalog", manifest: replacement, reason: "local" },
      { mfId: "catalog", manifest: replacement, reason: "historical" }
    ]),
    /duplicate entries/
  );
  assert.throws(
    () => resolveRuntimeManifests(catalog, [{ mfId: "catalog", manifest: createTestManifest({ id: "catalog", supportedHosts: ["admin"] }), reason: "local" }]),
    /does not support host "shell"/
  );
});

test("resolveRuntimeManifests rejects ambiguous exact routes", () => {
  const route = (id, basePath) => [{ id: `${id}-route`, kind: "route", hostId: "shell", route: { id, basePath, title: id } }];
  const catalog = {
    schemaVersion: "1",
    hostId: "shell",
    generatedAt: "now",
    manifests: [
      createTestManifest({ id: "first", placements: route("first", "/orders") }),
      createTestManifest({ id: "second", placements: route("second", "/orders/") })
    ]
  };

  assert.throws(() => resolveRuntimeManifests(catalog), /ambiguous exact route "\/orders"/);
});

test("resolveRuntimeManifests preserves catalog placement ownership", () => {
  const placement = { id: "catalog-route", kind: "route", hostId: "shell", route: { id: "catalog", basePath: "/catalog", title: "Catalog" } };
  const selected = createTestManifest({ id: "catalog", placements: [placement] });
  const replacement = createTestManifest({ id: "catalog", channel: "local", remoteEntryUrl: "http://localhost:4201/remoteEntry.json", placements: [] });
  const catalog = { schemaVersion: "1", hostId: "shell", generatedAt: "now", manifests: [selected] };

  const [resolved] = resolveRuntimeManifests(catalog, [{ mfId: "catalog", manifest: replacement, reason: "local" }]);

  assert.deepEqual(resolved.placements, [placement]);
  assert.deepEqual(resolved.supportedHosts, selected.supportedHosts);
});

test("resolveRuntimeManifests revalidates widget uses after an override", () => {
  const widget = { schemaVersion: "1", id: "summary", name: "Summary", ownerMfId: "orders", framework: "react", remoteEntryUrl: "https://cdn.example/widget.js", expose: "./summary", contractVersion: "1" };
  const owner = createTestManifest({ id: "orders", exportedComponents: [widget], placements: [] });
  const consumer = createTestManifest({ id: "dashboard", uses: ["orders/summary"], placements: [] });
  const replacement = createTestManifest({ id: "orders", channel: "local", remoteEntryUrl: "http://localhost:4201/remoteEntry.json", exportedComponents: [] });
  const catalog = { schemaVersion: "1", hostId: "shell", generatedAt: "now", manifests: [owner, consumer] };

  assert.throws(
    () => resolveRuntimeManifests(catalog, [{ mfId: "orders", manifest: replacement, reason: "local" }]),
    /is not exported by the selected runtime manifests/
  );
});

test("catalog loading retries transient failures", async () => {
  let attempts = 0;
  const catalog = await loadHostCatalog({
    catalogUrl: "https://cdn.example/hosts/shell/catalog.json",
    requestPolicy: { retryCount: 1, timeoutMs: 50 },
    async fetchJson() {
      attempts += 1;
      if (attempts === 1) throw new Error("temporary outage");
      return { schemaVersion: "1", hostId: "shell", generatedAt: "now", manifests: [] };
    }
  });

  assert.equal(attempts, 2);
  assert.equal(catalog.hostId, "shell");
});

test("catalog loading validates the complete host catalog", async () => {
  await assert.rejects(
    () => loadHostCatalog({ catalogUrl: "https://cdn.example/catalog.json", async fetchJson() { return { schemaVersion: "1", hostId: "", generatedAt: "now", manifests: [] }; } }),
    /Invalid Atlas host catalog/
  );
});

test("catalog loading passes resilience abort signals to custom fetch callbacks", async () => {
  let receivedSignal;
  await assert.rejects(
    () => loadHostCatalog({
      catalogUrl: "https://cdn.example/catalog.json",
      requestPolicy: { retryCount: 0, timeoutMs: 2 },
      fetchJson(_url, signal) { receivedSignal = signal; return new Promise(() => undefined); }
    }),
    AtlasLoadError
  );
  assert.equal(receivedSignal.aborted, true);
});

test("resilient operations emit structured retry and success events", async () => {
  const events = [];
  let attempts = 0;
  await runResiliently(
    async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("temporary outage");
      return "ready";
    },
    { stage: "catalog", resource: "https://cdn.example/catalog.json" },
    { retryCount: 1, timeoutMs: 50, observer: (event) => events.push(event) }
  );
  assert.deepEqual(events.map((event) => event.type), ["operation.retry", "operation.success"]);
  assert.equal(events[0].attempt, 1);
  assert.equal(events[1].attempt, 2);
});

test("timed out resilient operations are aborted before retry", async () => {
  const signals = [];
  await assert.rejects(
    () => runResiliently(
      (signal) => {
        signals.push(signal);
        return new Promise(() => undefined);
      },
      { stage: "catalog" },
      { retryCount: 1, timeoutMs: 2 }
    ),
    AtlasLoadError
  );
  assert.equal(signals.length, 2);
  assert.equal(signals.every((signal) => signal.aborted), true);
});

test("observer failures never affect runtime operations", async () => {
  const result = await runResiliently(
    async () => "ready",
    { stage: "catalog" },
    { observer() { throw new Error("monitor unavailable"); } }
  );
  assert.equal(result, "ready");
});

test("exhausted loading reports structured diagnostics", async () => {
  await assert.rejects(
    () => runResiliently(
      async () => { throw new Error("offline"); },
      { stage: "remote-module", resource: "https://cdn.example/entry.js", mfId: "map", version: "3.2.1" },
      { retryCount: 1, timeoutMs: 50 }
    ),
    (error) => {
      assert.equal(error instanceof AtlasLoadError, true);
      assert.equal(error.stage, "remote-module");
      assert.equal(error.mfId, "map");
      assert.equal(error.version, "3.2.1");
      assert.equal(error.attempts, 2);
      return true;
    }
  );
});

test("Native Federation module imports use the configured retry policy", async () => {
  const manifest = createTestManifest({ channel: "local" });
  let attempts = 0;
  const importers = createNativeFederationImporters({
    async initFederation() {},
    async loadRemoteModule() {
      attempts += 1;
      if (attempts === 1) throw new Error("chunk unavailable");
      return { mount() {} };
    }
  }, { retryCount: 1, timeoutMs: 50 });
  await importers.initialize([manifest]);

  await importers.importRemote(manifest);

  assert.equal(attempts, 2);
});

test("Native Federation initializes independent remotes concurrently", async () => {
  let active = 0;
  let maximumActive = 0;
  const importers = createNativeFederationImporters({
    async initFederation() {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
    },
    async loadRemoteModule() { return { mount() {} }; }
  }, { retryCount: 0, timeoutMs: 50 });

  await importers.initialize([createTestManifest({ id: "first" }), createTestManifest({ id: "second" })]);

  assert.equal(maximumActive, 2);
});

test("Native Federation bounds parallel remote initialization", async () => {
  let active = 0;
  let maximumActive = 0;
  const importers = createNativeFederationImporters({
    async initFederation() {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
    },
    async loadRemoteModule() { return { mount() {} }; }
  }, { retryCount: 0, timeoutMs: 50 });
  const manifests = Array.from({ length: 12 }, (_, index) => createTestManifest({ id: `mf-${index}` }));

  await importers.initialize(manifests);

  assert.equal(maximumActive, 8);
});

test("host UI uses one host-owned outlet and supports custom loading and fallback renderers", () => {
  const container = createHostStatusContainer();
  const document = { querySelector: () => container };
  let retry;
  let disposed = false;
  const states = [];
  const ui = createHostUi({
    document,
    renderHostLoading(target) { states.push("loading"); target.textContent = "Preparing workspace"; return () => { disposed = true; }; },
    renderHostError(target, error, retryAction) { states.push(error.message); target.textContent = "Custom fallback"; retry = retryAction; }
  });
  ui.showLoading();
  ui.showError(new Error("catalog unavailable"), () => states.push("retried"));
  retry();

  assert.deepEqual(states, ["loading", "catalog unavailable", "retried"]);
  assert.equal(disposed, true);
  assert.equal(container.dataset.atlasState, "error");
  assert.equal(container.textContent, "Custom fallback");
});

test("browser overrides are discovered from the host URL and validated", async () => {
  const manifest = createTestManifest({ channel: "local", remoteEntryUrl: "http://localhost:4201/remoteEntry.json" });
  let requestedUrl;
  const overrides = await loadBrowserRuntimeOverrides({
    hostId: "shell",
    enabled: true,
    search: "?atlas-override=http%3A%2F%2Flocalhost%3A4400%2Fatlas.local-overrides.json",
    storage: { getItem() { return null; } },
    async fetchJson(url) {
      requestedUrl = url;
      return { schemaVersion: "1", hostId: "shell", generatedAt: new Date().toISOString(), overrides: [{ mfId: manifest.id, manifest, reason: "local" }] };
    }
  });
  assert.equal(requestedUrl, "http://localhost:4400/atlas.local-overrides.json");
  assert.equal(overrides[0].manifest.remoteEntryUrl, "http://localhost:4201/remoteEntry.json");
});

test("browser overrides cannot cross host boundaries", async () => {
  await assert.rejects(() => loadBrowserRuntimeOverrides({
    hostId: "shell",
    enabled: true,
    search: "?atlas-override=http://localhost/override.json",
    storage: { getItem() { return null; } },
    async fetchJson() { return { schemaVersion: "1", hostId: "admin", generatedAt: "now", overrides: [] }; }
  }), /targets host "admin"/);
});

test("browser overrides load a directly persisted extension document", async () => {
  const manifest = createTestManifest({ channel: "historical", version: "0.8.0" });
  const overrides = await loadBrowserRuntimeOverrides({
    hostId: "shell",
    enabled: true,
    search: "",
    storage: { getItem(key) { return key === ATLAS_OVERRIDE_DOCUMENT_STORAGE_KEY ? JSON.stringify({ schemaVersion: "1", hostId: "shell", generatedAt: "now", overrides: [{ mfId: manifest.id, manifest, reason: "historical" }] }) : null; } }
  });
  assert.equal(overrides[0].manifest.version, "0.8.0");
});

test("tab-scoped browser overrides take precedence over all-tab overrides", async () => {
  const production = createTestManifest({ id: "orders", version: "1.0.0" });
  const tab = createTestManifest({ id: "orders", version: "3.0.0", channel: "historical" });
  const all = createTestManifest({ id: "orders", version: "2.0.0", channel: "historical" });
  const documentFor = (manifest) => JSON.stringify({ schemaVersion: "1", hostId: "shell", generatedAt: new Date().toISOString(), overrides: [{ mfId: "orders", manifest, reason: "historical" }] });
  const overrides = await loadBrowserRuntimeOverrides({
    hostId: "shell",
    enabled: true,
    storage: { getItem: (key) => key === "atlas.runtime-overrides" ? documentFor(all) : null },
    sessionStorage: { getItem: (key) => key === "atlas.runtime-overrides" ? documentFor(tab) : null }
  });
  const catalog = { schemaVersion: "1", hostId: "shell", generatedAt: new Date().toISOString(), manifests: [production] };
  assert.equal(resolveRuntimeManifests(catalog, overrides)[0].version, "3.0.0");
});

test("browser override URL and storage access are disabled by default", async () => {
  let accessed = false;
  const overrides = await loadBrowserRuntimeOverrides({
    hostId: "shell",
    search: "?atlas-override=https://attacker.example/override.json",
    storage: { getItem() { accessed = true; return "ignored"; } },
    async fetchJson() { accessed = true; throw new Error("must not fetch"); }
  });
  assert.deepEqual(overrides, []);
  assert.equal(accessed, false);
});

test("local override assets must use loopback URLs", () => {
  const selected = createTestManifest({ id: "catalog" });
  const replacement = createTestManifest({ id: "catalog", channel: "local", remoteEntryUrl: "http://192.168.1.20/remoteEntry.json" });
  const catalog = { schemaVersion: "1", hostId: "shell", generatedAt: "now", manifests: [selected] };
  assert.throws(
    () => resolveRuntimeManifests(catalog, [{ mfId: "catalog", manifest: replacement, reason: "local" }]),
    /must use loopback/
  );
});

test("component loader mounts from the selected owner version", async () => {
  const component = { schemaVersion: "1", id: "product-count", name: "Product Count", ownerMfId: "catalog", framework: "react", remoteEntryUrl: "https://cdn.example/widget.js", expose: "./components/product-count", contractVersion: "1" };
  const manifest = createTestManifest({ exportedComponents: [component] });
  let request;
  let unmounted = false;
  const loader = createComponentLoader([manifest], {}, async () => ({ mount(value) { request = value; return { unmount: () => { unmounted = true; } }; } }));
  assert.deepEqual(loader.list("catalog"), [component]);
  const mounted = await loader.mount("catalog/product-count", {}, { count: 4 });
  assert.deepEqual(request.props, { count: 4 });
  assert.equal(request.ownerManifest.version, "1.0.0");
  await mounted.unmount();
  assert.equal(unmounted, true);
});

test("component loader rejects components outside the selected catalog", async () => {
  const loader = createComponentLoader([], {});
  await assert.rejects(() => loader.mount("unknown/widget", {}, {}), /not available in the selected catalog/);
});

test("widget loader is the primary alias and page MFs receive one shared widget loader", async () => {
  assert.equal(createWidgetLoader, createComponentLoader);
  let received;
  await mountMicrofrontend({
    hostId: "shell",
    catalogUrl: "",
    hostSdk: createTestHostSdk(),
    manifest: createTestManifest(),
    container: {},
    componentLoader: createWidgetLoader([], {}),
    async importRemote() { return { mount({ context }) { received = context; } }; }
  });
  assert.equal(received.widgets, received.components);
});

test("MF mounts receive an Atlas-owned scoped DOM boundary", async () => {
  const created = [];
  const document = { createElement() { const element = { dataset: {}, ownerDocument: document, append() {}, remove() { element.removed = true; } }; created.push(element); return element; } };
  const parent = { ownerDocument: document, append(element) { this.child = element; } };
  let receivedContainer;
  const mounted = await mountMicrofrontend({
    hostId: "shell",
    catalogUrl: "",
    hostSdk: createTestHostSdk(),
    manifest: createTestManifest({ id: "map", isolation: "scoped" }),
    container: parent,
    async importRemote() { return { mount({ container }) { receivedContainer = container; } }; }
  });
  assert.equal(parent.child, receivedContainer);
  assert.equal(receivedContainer.dataset.atlasMf, "map");
  await mounted.unmount();
  assert.equal(receivedContainer.removed, true);
});

test("host loads MF styles before mount and releases them after the final unmount", async () => {
  const events = [];
  const document = createStylesheetDocument(events);
  const container = { ownerDocument: document, append() {} };
  const manifest = createTestManifest({ styles: [{ href: "https://cdn.example/catalog/styles.css", integrity: "sha256-valid" }] });
  const options = {
    hostId: "shell",
    catalogUrl: "",
    hostSdk: createTestHostSdk(),
    manifest,
    container,
    async importRemote() { events.push("import"); return { mount() { events.push("mount"); } }; }
  };

  const first = await mountMicrofrontend(options);
  const second = await mountMicrofrontend(options);
  assert.deepEqual(events.slice(0, 3), ["style", "import", "mount"]);
  assert.equal(document.links.length, 1);
  assert.equal(document.links[0].crossOrigin, "anonymous");
  await first.unmount();
  assert.equal(document.links[0].removed, undefined);
  await second.unmount();
  assert.equal(document.links[0].removed, true);
});

test("stylesheet failures prevent remote mounting", async () => {
  const document = createStylesheetDocument([], "error");
  let imported = false;
  await assert.rejects(() => mountMicrofrontend({
    hostId: "shell",
    catalogUrl: "",
    hostSdk: createTestHostSdk(),
    manifest: createTestManifest({ styles: [{ href: "https://cdn.example/catalog/missing.css", integrity: "sha256-valid" }] }),
    container: { ownerDocument: document, append() {} },
    async importRemote() { imported = true; return { mount() {} }; }
  }), /could not load stylesheet/);
  assert.equal(imported, false);
});

test("stylesheet trust rejects unsupported protocols before import", async () => {
  let imported = false;
  const base = {
    hostId: "shell",
    catalogUrl: "",
    hostSdk: createTestHostSdk(),
    container: { ownerDocument: createStylesheetDocument([]), append() {} },
    async importRemote() { imported = true; return { mount() {} }; }
  };
  await assert.rejects(
    () => mountMicrofrontend({ ...base, manifest: createTestManifest({ remoteEntryUrl: "https://cdn.example/entry.js", styles: [{ href: "ftp://cdn.example/styles.css" }] }) }),
    /unsupported stylesheet protocol/
  );
  assert.equal(imported, false);
});

test("host runtime mounts only the active route and unmounts during navigation", async () => {
  const catalog = createTestManifest({ id: "catalog", placements: [{ id: "catalog-route", kind: "route", hostId: "shell", route: { id: "catalog", basePath: "/catalog", title: "Catalog" } }] });
  const details = createTestManifest({ id: "details", placements: [{ id: "details-route", kind: "route", hostId: "shell", route: { id: "details", basePath: "/catalog/details", title: "Details" } }] });
  const sdk = createTestHostSdk();
  const events = [];
  const unmounted = [];
  const runtime = await startAtlasHostRuntime({
    hostId: "shell",
    manifests: [catalog, details],
    hostSdk: sdk,
    resolveRouteContainer() { return {}; },
    resolveSlotContainer() { return undefined; },
    onStateChange(event) { events.push(`${event.manifest.id}:${event.state}`); },
    async importRemote(manifest) {
      return { mount() { return { unmount() { unmounted.push(manifest.id); } }; } };
    }
  });
  assert.deepEqual(events, []);
  sdk.navigation.navigate("/catalog");
  await tick();
  assert.ok(events.includes("catalog:mounted"));
  sdk.navigation.navigate("/catalog/details/42");
  await tick();
  assert.ok(unmounted.includes("catalog"));
  assert.ok(events.includes("details:mounted"));
  await runtime.stop();
  assert.ok(unmounted.includes("details"));
});

test("host runtime mounts slots independently and reports remote failures", async () => {
  const widget = createTestManifest({ id: "widget", placements: [{ id: "header-widget", kind: "slot", hostId: "shell", slot: "header" }] });
  const sdk = createTestHostSdk();
  const states = [];
  const runtime = await startAtlasHostRuntime({
    hostId: "shell",
    manifests: [widget],
    hostSdk: sdk,
    resolveRouteContainer() { return undefined; },
    resolveSlotContainer() { return {}; },
    onStateChange(event) { states.push(event); },
    async importRemote() { throw new Error("CDN unavailable"); }
  });
  assert.deepEqual(states.map(({ state }) => state), ["mounting", "error"]);
  assert.match(states[1].error.message, /CDN unavailable/);
  await runtime.stop();
});

test("host runtime starts independent slots concurrently", async () => {
  const placements = (id) => [{ id: `${id}-slot`, kind: "slot", hostId: "shell", slot: id }];
  let active = 0;
  let maximumActive = 0;
  const runtime = await startAtlasHostRuntime({
    hostId: "shell",
    manifests: [createTestManifest({ id: "first", placements: placements("first") }), createTestManifest({ id: "second", placements: placements("second") })],
    hostSdk: createTestHostSdk(),
    resolveRouteContainer() { return undefined; },
    resolveSlotContainer() { return {}; },
    async importRemote() {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return { mount() {} };
    }
  });
  assert.equal(maximumActive, 2);
  await runtime.stop();
});

test("host runtime cleans up mounts that finish after their timeout", async () => {
  const widget = createTestManifest({ id: "late", placements: [{ id: "late-slot", kind: "slot", hostId: "shell", slot: "late" }] });
  let unmounted = 0;
  const runtime = await startAtlasHostRuntime({
    hostId: "shell",
    manifests: [widget],
    hostSdk: createTestHostSdk(),
    resourcesTimeoutMs: 2,
    resolveRouteContainer() { return undefined; },
    resolveSlotContainer() { return {}; },
    async importRemote() {
      return { async mount() { await new Promise((resolve) => setTimeout(resolve, 10)); return { unmount() { unmounted += 1; } }; } };
    }
  });
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(unmounted, 1);
  await runtime.stop();
});

test("host runtime coalesces overlapping retries for one failed placement", async () => {
  const widget = createTestManifest({ id: "retry", placements: [{ id: "retry-slot", kind: "slot", hostId: "shell", slot: "retry" }] });
  let imports = 0;
  const runtime = await startAtlasHostRuntime({
    hostId: "shell",
    manifests: [widget],
    hostSdk: createTestHostSdk(),
    resourcesTimeoutMs: 2,
    resolveRouteContainer() { return undefined; },
    resolveSlotContainer() { return {}; },
    async importRemote() {
      imports += 1;
      if (imports === 1) return new Promise(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { mount() {} };
    }
  });
  await Promise.all([runtime.retry("retry"), runtime.retry("retry")]);
  assert.equal(imports, 2);
  await runtime.stop();
});

test("host runtime shows loading UI only when requested by the MF", async () => {
  const widget = createTestManifest({ id: "widget", placements: [{ id: "header-widget", kind: "slot", hostId: "shell", slot: "header" }] });
  const states = [];
  const runtime = await startAtlasHostRuntime({
    hostId: "shell",
    manifests: [widget],
    hostSdk: createTestHostSdk(),
    resolveRouteContainer() { return undefined; },
    resolveSlotContainer() { return {}; },
    onStateChange(event) { states.push(event.state); },
    async importRemote() {
      return { mount({ context }) { context.loading.show(); setTimeout(() => context.loading.hide(), 5); } };
    }
  });
  assert.deepEqual(states, ["mounting", "loading", "mounted"]);
  await runtime.stop();
});

test("host runtime renders no loading state when the MF does not request one", async () => {
  const widget = createTestManifest({ id: "widget", placements: [{ id: "header-widget", kind: "slot", hostId: "shell", slot: "header" }] });
  const states = [];
  const runtime = await startAtlasHostRuntime({
    hostId: "shell",
    manifests: [widget],
    hostSdk: createTestHostSdk(),
    resolveRouteContainer() { return undefined; },
    resolveSlotContainer() { return {}; },
    onStateChange(event) { states.push(event.state); },
    async importRemote() { return { mount() {} }; }
  });
  assert.deepEqual(states, ["mounting", "mounted"]);
  await runtime.stop();
});

test("host runtime reports and cleans up an MF that opts into readiness but never becomes ready", async () => {
  const widget = createTestManifest({ id: "widget", placements: [{ id: "header-widget", kind: "slot", hostId: "shell", slot: "header" }] });
  const states = [];
  let unmounted = false;
  const runtime = await startAtlasHostRuntime({
    hostId: "shell",
    manifests: [widget],
    hostSdk: createTestHostSdk(),
    resourcesTimeoutMs: 5,
    resolveRouteContainer() { return undefined; },
    resolveSlotContainer() { return {}; },
    onStateChange(event) { states.push(event); },
    async importRemote() { return { mount({ context }) { context.loading.waitUntilReady(); return { unmount() { unmounted = true; } }; } }; }
  });
  assert.equal(unmounted, true);
  assert.deepEqual(states.map(({ state }) => state), ["mounting", "loading", "error"]);
  assert.match(states[2].error.message, /did not mark itself ready/);
  await runtime.stop();
});

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function createStylesheetDocument(events, outcome = "load") {
  const links = [];
  const document = {
    links,
    head: {
      append(element) {
        links.push(element);
        events.push("style");
        queueMicrotask(() => element.listeners[outcome]?.());
      }
    },
    createElement(tag) {
      if (tag !== "link") return { dataset: {}, ownerDocument: document, append() {}, remove() {} };
      return {
        dataset: {},
        listeners: {},
        addEventListener(name, listener) { this.listeners[name] = listener; },
        remove() { this.removed = true; }
      };
    }
  };
  return document;
}

function createHostStatusContainer() {
  return {
    dataset: {},
    attributes: new Map(),
    textContent: "",
    setAttribute(name, value) { this.attributes.set(name, value); },
    removeAttribute(name) { this.attributes.delete(name); },
    replaceChildren(...children) {
      this.children = children;
      this.textContent = children.map((child) => child.textContent ?? "").join("");
    }
  };
}

test("remote entry integrity rejects modified production assets", async () => {
  const manifest = createTestManifest({ integrity: "sha256-LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ=" });
  await verifyManifestIntegrity([manifest], async () => new TextEncoder().encode("hello").buffer);
  await assert.rejects(
    () => verifyManifestIntegrity([manifest], async () => new TextEncoder().encode("changed").buffer),
    /failed remote entry integrity/
  );
});

test("production remotes allow optional integrity and require HTTP URLs", async () => {
  const missingIntegrity = createTestManifest({ remoteEntryUrl: "https://assets.example.com/remoteEntry.json" });
  await verifyManifestIntegrity([missingIntegrity], async () => new ArrayBuffer(0));

  const unsupportedProtocol = createTestManifest({
    remoteEntryUrl: "ftp://assets.example.com/remoteEntry.json",
    integrity: "sha256-LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ="
  });
  await assert.rejects(
    () => verifyManifestIntegrity([unsupportedProtocol], async () => new TextEncoder().encode("hello").buffer),
    /unsupported remote protocol/
  );
});

test("local remotes stay exempt from production trust checks", async () => {
  const local = createTestManifest({ channel: "local", remoteEntryUrl: "http://localhost:4201/remoteEntry.json" });
  await verifyManifestIntegrity([local], async () => new ArrayBuffer(0));
});

test("runtime config creates a resource policy", async () => {
  const config = await loadHostRuntimeConfig("/atlas.runtime.json", async () => ({
    schemaVersion: "1",
    hostId: "shell",
    catalogUrl: "https://registry.example.com/atlas/hosts/shell/catalog.json",
    allowAppOverrides: true,
    resourcesTimeoutMs: 15000,
    resourcesRetryCount: 3
  }));
  assert.deepEqual(createRemoteTrustPolicy(config), {});
});

test("runtime config rejects invalid resource settings", async () => {
  await assert.rejects(
    () => loadHostRuntimeConfig("/atlas.runtime.json", async () => ({
      schemaVersion: "1",
      hostId: "shell",
      catalogUrl: "https://registry.example.com/catalog.json",
      resourcesRetryCount: -1
    })),
    /resourcesRetryCount/
  );
});

test("federation isolates rejected remotes while trusted MFs remain loadable", async () => {
  const rejected = createTestManifest({ id: "rejected", remoteEntryUrl: "https://assets.example.com/rejected.json" });
  const local = createTestManifest({ id: "local", channel: "local", remoteEntryUrl: "http://localhost:4201/remoteEntry.json" });
  const initialized = [];
  const federation = await createTrustedNativeFederationImporters({
    async initFederation(remotes) { initialized.push(...Object.keys(remotes)); },
    async loadRemoteModule() { return { mount() {} }; }
  }, [rejected, local], {});

  assert.deepEqual(initialized, ["atlas_rejected", "atlas_local"]);
  assert.equal(typeof (await federation.importRemote(rejected)).mount, "function");
  assert.equal(typeof (await federation.importRemote(local)).mount, "function");
});
