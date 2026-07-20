import { test } from "@jest/globals";
import assert from "node:assert/strict";
import { ATLAS_OVERRIDE_DOCUMENT_STORAGE_KEY, AtlasLoadError, createHostNavigationItems, createHostUi, createNativeFederationImporters, createRegistryWidgetResolver, createRemoteTrustPolicy, createTrustedNativeFederationImporters, createWidgetLoader, loadBrowserRuntimeOverrides, loadHostCatalog, loadHostRuntimeConfig, mountApp, resolveRuntimeManifests, rewriteAssetUrl, rewriteCssAssetUrls, runResiliently, startAtlasHostRuntime, startRemoteAssetRewrite, verifyManifestIntegrity } from "../dist/index.js";
import { startDomHostRuntime } from "../dist/dom-host-runtime.js";
import { renderHostMountState } from "../dist/dom-rendering.js";
import { createTestHostSdk, createTestManifest } from "../../testkit/dist/index.js";
import type { AtlasExportedWidgetManifest, AtlasHostCatalog, AtlasManifest, AtlasPlacement } from "../../schema/dist/index.js";
import type { AtlasNavigation } from "../../sdk/dist/index.js";
import type { AtlasAppContext, AtlasExportedWidgetMountRequest } from "../../sdk/dist/lifecycle.js";
import type { AtlasHostMountEvent, AtlasRuntimeEvent } from "../dist/index.js";
import { HostRuntimeDriver, WidgetRegistryDriver, WidgetRetryDriver, createDeferred, createHostCatalog, createRouteManifest, createRoutePlacement, createSlotManifest, createTestContainer, createTestDocument, createTestElement, createWidgetRendererContainer, duplicateRegistryWidgetResult, duplicateWidgetResult, widgetProvider, widgetRegistry } from "./loader.driver.js";

test("resolveRuntimeManifests rejects duplicate selected app versions", () => {
  const catalog = createHostCatalog([
      createTestManifest({ version: "1.0.0" }),
      createTestManifest({ version: "2.0.0" })
  ]);

  assert.throws(() => resolveRuntimeManifests(catalog), /multiple selected versions/);
});

test("resolveRuntimeManifests applies overrides", () => {
  const production = createTestManifest({ version: "1.0.0", channel: "production" });
  const local = createTestManifest({ id: "catalog", version: "2.0.0", channel: "local", remoteEntryUrl: "http://localhost:4201/remoteEntry.json" });
  const catalog = createHostCatalog([production]);

  const manifests = resolveRuntimeManifests(catalog, [{ appId: "catalog", manifest: local, reason: "local" }]);

  assert.equal(manifests[0].version, "2.0.0");
});

test("resolveRuntimeManifests treats wildcard supportedHosts as universal", () => {
  const manifest = createTestManifest({ supportedHosts: ["*"] });
  const catalog = createHostCatalog([manifest], "partner-host");

  assert.deepEqual(resolveRuntimeManifests(catalog), [manifest]);
});

test("resolveRuntimeManifests rejects unknown, duplicate, and host-incompatible overrides", () => {
  const selected = createTestManifest({ id: "catalog" });
  const catalog = createHostCatalog([selected]);
  const replacement = createTestManifest({ id: "catalog", version: "2.0.0" });

  assert.throws(
    () => resolveRuntimeManifests(catalog, [{ appId: "unknown", manifest: createTestManifest({ id: "unknown" }), reason: "local" }]),
    /not selected by the host catalog/
  );
  assert.throws(
    () => resolveRuntimeManifests(catalog, [
      { appId: "catalog", manifest: replacement, reason: "local" },
      { appId: "catalog", manifest: replacement, reason: "historical" }
    ]),
    /duplicate entries/
  );
  assert.throws(
    () => resolveRuntimeManifests(catalog, [{ appId: "catalog", manifest: createTestManifest({ id: "catalog", supportedHosts: ["admin"] }), reason: "local" }]),
    /does not support host "host"/
  );
});

test("resolveRuntimeManifests preserves ambiguous exact routes for runtime conflict reporting", () => {
  const route = (id: string, basePath: string): AtlasPlacement[] => [createRoutePlacement(id, basePath)];
  const catalog = createHostCatalog([
    createTestManifest({ id: "first", placements: route("first", "/orders") }),
    createTestManifest({ id: "second", placements: route("second", "/orders/") })
  ]);

  assert.deepEqual(resolveRuntimeManifests(catalog).map((manifest) => manifest.id), ["first", "second"]);
});

test("resolveRuntimeManifests preserves catalog placement ownership", () => {
  const placement: AtlasPlacement = { id: "catalog-route", kind: "route", hostId: "host", route: { basePath: "/catalog", title: "Catalog" } };
  const selected = createTestManifest({ id: "catalog", placements: [placement] });
  const replacement = createTestManifest({ id: "catalog", channel: "local", remoteEntryUrl: "http://localhost:4201/remoteEntry.json", placements: [] });
  const catalog = createHostCatalog([selected]);

  const [resolved] = resolveRuntimeManifests(catalog, [{ appId: "catalog", manifest: replacement, reason: "local" }]);

  assert.deepEqual(resolved.placements, [placement]);
  assert.deepEqual(resolved.supportedHosts, selected.supportedHosts);
});

test("createHostNavigationItems exposes resolved route metadata for custom host nav", () => {
  const visited: string[] = [];
  const navigation: AtlasNavigation = {
    navigate(to) { visited.push(to); },
    replace() {},
    back() {},
    createHref(to) { return `/app${to}`; },
    subscribe() { return () => undefined; },
    getCurrentLocation() { return { pathname: "/orders/42", search: "", hash: "" }; }
  };
  const manifests = [
    createTestManifest({
      id: "catalog",
      name: "Catalog",
      placements: [{ id: "catalog-route", kind: "route", hostId: "host", route: { basePath: "/catalog", title: "Catalog", nav: { label: "Catalog", order: 20 } } }]
    }),
    createTestManifest({
      id: "orders",
      name: "Orders",
      placements: [{ id: "orders-route", kind: "route", hostId: "host", route: { basePath: "/orders", title: "Orders", nav: { label: "Orders", order: 10 } } }]
    }),
    createTestManifest({
      id: "hidden",
      name: "Hidden",
      placements: [{ id: "hidden-route", kind: "route", hostId: "host", route: { basePath: "/hidden", title: "Hidden", nav: { label: "Hidden", visible: false } } }]
    })
  ];

  const items = createHostNavigationItems(manifests, "host", navigation);

  assert.deepEqual(items.map((item) => item.label), ["Orders", "Catalog"]);
  assert.equal(items[0].active, true);
  assert.equal(items[0].href, "/app/orders");
  items[0].navigate();
  assert.deepEqual(visited, ["/orders"]);
});

test("createHostNavigationItems keeps the first app for duplicate exact routes", () => {
  const navigation: AtlasNavigation = {
    navigate() {},
    replace() {},
    back() {},
    createHref(to) { return to; },
    subscribe() { return () => undefined; },
    getCurrentLocation() { return { pathname: "/catalog", search: "", hash: "" }; }
  };
  const route = (id: string, basePath: string): AtlasPlacement[] => [createRoutePlacement(id, basePath)];
  const manifests = [
    createTestManifest({ id: "first", placements: route("first", "/orders") }),
    createTestManifest({ id: "second", placements: route("second", "/orders/") }),
    createTestManifest({ id: "catalog", placements: route("catalog", "/catalog") })
  ];

  assert.deepEqual(createHostNavigationItems(manifests, "host", navigation).map((item) => item.appId), ["first", "catalog"]);
});

test("resolveRuntimeManifests does not require consumed widgets in app manifests", () => {
  const widget: AtlasExportedWidgetManifest = { schemaVersion: "1", id: "summary", name: "Summary", ownerAppId: "orders", framework: "react", remoteEntryUrl: "https://cdn.example/widget.js", expose: "./summary", contractVersion: "1" };
  const owner = createTestManifest({ id: "orders", exportedWidgets: [widget], placements: [] });
  const consumer = createTestManifest({ id: "dashboard", placements: [] });
  const replacement = createTestManifest({ id: "orders", channel: "local", remoteEntryUrl: "http://localhost:4201/remoteEntry.json", exportedWidgets: [] });
  const catalog = createHostCatalog([owner, consumer]);

  assert.equal(resolveRuntimeManifests(catalog, [{ appId: "orders", manifest: replacement, reason: "local" }]).length, 2);
});

test("catalog loading retries transient failures", async () => {
  let attempts = 0;
  const catalog = await loadHostCatalog({
    catalogUrl: "https://cdn.example/hosts/host/catalog.json",
    requestPolicy: { retryCount: 1, timeoutMs: 50 },
    async fetchJson() {
      attempts += 1;
      if (attempts === 1) throw new Error("temporary outage");
      return createHostCatalog([]);
    }
  });

  assert.equal(attempts, 2);
  assert.equal(catalog.hostId, "host");
});

test("catalog loading validates the complete host catalog", async () => {
  await assert.rejects(
    () => loadHostCatalog({ catalogUrl: "https://cdn.example/catalog.json", async fetchJson() { return { ...createHostCatalog([]), hostId: "" }; } }),
    /Invalid Atlas host catalog/
  );
});

test("catalog loading passes resilience abort signals to custom fetch callbacks", async () => {
  let receivedSignal: AbortSignal | undefined;
  await assert.rejects(
    () => loadHostCatalog({
      catalogUrl: "https://cdn.example/catalog.json",
      requestPolicy: { retryCount: 0, timeoutMs: 2 },
      fetchJson(_url, signal) { receivedSignal = signal; return new Promise(() => undefined); }
    }),
    AtlasLoadError
  );
  assert.equal(receivedSignal?.aborted, true);
});

test("resilient operations emit structured retry and success events", async () => {
  const events: AtlasRuntimeEvent[] = [];
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
  if (events[0]?.type !== "operation.retry" || events[1]?.type !== "operation.success") {
    throw new Error("Expected retry and success operation events.");
  }
  assert.equal(events[0].attempt, 1);
  assert.equal(events[1].attempt, 2);
});

test("timed out resilient operations are aborted before retry", async () => {
  const signals: AbortSignal[] = [];
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
      { stage: "remote-module", resource: "https://cdn.example/entry.js", appId: "map", version: "3.2.1" },
      { retryCount: 1, timeoutMs: 50 }
    ),
    (error) => {
      if (!(error instanceof AtlasLoadError)) return false;
      assert.equal(error.stage, "remote-module");
      assert.equal(error.appId, "map");
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

test("Native Federation initializes local remotes independently", async () => {
  const initialized: Array<Record<string, string>> = [];
  const options: Array<{ deployUrl?: string } | undefined> = [];
  const loaded: string[] = [];
  const importers = createNativeFederationImporters({
    async initFederation(remotes, federationOptions) {
      initialized.push(remotes);
      options.push(federationOptions);
    },
    async loadRemoteModule(remoteName) {
      loaded.push(remoteName);
      return { mount() {} };
    }
  }, { retryCount: 0, timeoutMs: 50 }, "https://cdn.example/hosts/customer-host/1.0.0/build-1/remoteEntry.json");
  const first = createTestManifest({ id: "first", remoteEntryUrl: "http://localhost:4201/remoteEntry.json" });
  const second = createTestManifest({ id: "second", remoteEntryUrl: "http://localhost:4202/remoteEntry.json" });

  await importers.initialize([first, second]);
  await importers.importRemote(first);
  await importers.importRemote(second);

  assert.deepEqual(initialized, [
    { atlas_first: "http://localhost:4201/remoteEntry.json" },
    { atlas_second: "http://localhost:4202/remoteEntry.json" }
  ]);
  assert.deepEqual(loaded, ["atlas_first", "atlas_second"]);
  assert.deepEqual(options, [
    { deployUrl: "https://cdn.example/hosts/customer-host/1.0.0/build-1/" },
    { deployUrl: "https://cdn.example/hosts/customer-host/1.0.0/build-1/" }
  ]);
});

test("Native Federation keeps healthy remotes loadable when another initialization fails", async () => {
  const initialized: string[][] = [];
  const importers = createNativeFederationImporters({
    async initFederation(remotes) {
      initialized.push(Object.keys(remotes));
      if ("atlas_broken" in remotes) throw new Error("CDN unavailable");
    },
    async loadRemoteModule() { return { mount() {} }; }
  }, { retryCount: 0, timeoutMs: 50 });
  const healthy = createTestManifest({ id: "healthy" });
  const broken = createTestManifest({ id: "broken" });

  await importers.initialize([healthy, broken]);
  await importers.importRemote(healthy);

  assert.deepEqual(initialized, [
    ["atlas_healthy"],
    ["atlas_broken"]
  ]);
  await assert.rejects(() => importers.importRemote(broken), /CDN unavailable/);
});

test("host UI uses one host-owned outlet and supports custom loading and fallback renderers", () => {
  const container = createHostStatusContainer();
  const document = createTestDocument();
  document.querySelector = () => container;
  let retry: (() => void) | undefined;
  let disposed = false;
  const states: string[] = [];
  const ui = createHostUi({
    document,
    renderHostLoading(target) { states.push("loading"); target.textContent = "Preparing workspace"; return () => { disposed = true; }; },
    renderHostError(target, error, retryAction) { states.push(error.message); target.textContent = "Custom fallback"; retry = retryAction; }
  });
  ui.showLoading();
  ui.showError(new Error("catalog unavailable"), () => states.push("retried"));
  if (!retry) throw new Error("Expected host retry callback.");
  retry();

  assert.deepEqual(states, ["loading", "catalog unavailable", "retried"]);
  assert.equal(disposed, true);
  assert.equal(container.dataset["atlasState"], "error");
  assert.equal(container.textContent, "Custom fallback");
});

test("default host UI hides diagnostic details", () => {
  const container = createHostStatusContainer();
  const document = createTestDocument();
  document.querySelector = () => container;
  document.createElement = () => {
    const element = createTestElement();
    element.textContent = "";
    element.setAttribute = () => undefined;
    element.addEventListener = () => undefined;
    element.append = (...children) => { element.textContent = children.map((child) => typeof child === "string" ? child : child.textContent).join(""); };
    return element;
  };
  const ui = createHostUi({ document });

  ui.showError(new Error('Invalid Atlas host catalog. manifests.1.id: Duplicate app id "angular-app".'), () => undefined);

  assert.equal(container.textContent, "Unable to start application. Retry");
  assert.doesNotMatch(container.textContent, /Duplicate app id|Suggested action/);
});

test("host placement state never removes a nested widget status", () => {
  const widgetStatus = createTestElement();
  let widgetStatusRemoved = false;
  widgetStatus.remove = () => { widgetStatusRemoved = true; };
  const container = createTestElement();
  container.setAttribute = () => undefined;
  container.querySelector = ((selector: string) => selector === ":scope > [data-atlas-placement-status]" ? null : widgetStatus) as typeof container.querySelector;
  const document = createTestDocument();
  document.querySelector = () => container;
  const manifest = createTestManifest();

  renderHostMountState(document, {
    manifest,
    placement: manifest.placements[0]!,
    state: "mounted"
  }, () => undefined, {
    federation: {
      async initFederation() {},
      async loadRemoteModule() { return {}; }
    }
  });

  assert.equal(widgetStatusRemoved, false);
});

test("browser overrides are discovered from the host URL and validated", async () => {
  const manifest = createTestManifest({ channel: "local", remoteEntryUrl: "http://localhost:4201/remoteEntry.json" });
  let requestedUrl;
  const overrides = await loadBrowserRuntimeOverrides({
    hostId: "host",
    allowCustomOverrides: true,
    search: "?atlas-override=http%3A%2F%2Flocalhost%3A4400%2Fatlas.local-overrides.json",
    storage: { getItem() { return null; } },
    async fetchJson(url) {
      requestedUrl = url;
      return { schemaVersion: "1", hostId: "host", generatedAt: new Date().toISOString(), overrides: [{ appId: manifest.id, manifest, reason: "local" }] };
    }
  });
  assert.equal(requestedUrl, "http://localhost:4400/atlas.local-overrides.json");
  assert.equal(overrides[0].manifest.remoteEntryUrl, "http://localhost:4201/remoteEntry.json");
});

test("browser overrides discover the matching local dev session without URL parameters", async () => {
  const manifest = createTestManifest({ channel: "local", remoteEntryUrl: "http://localhost:4201/remoteEntry.json" });
  let requestedUrl;
  const overrides = await loadBrowserRuntimeOverrides({
    hostId: "host",
    allowCustomOverrides: true,
    search: "",
    storage: { getItem() { return null; } },
    sessionStorage: { getItem() { return null; } },
    async fetchJson(url) {
      requestedUrl = url;
      return { schemaVersion: "1", hostId: "host", generatedAt: new Date().toISOString(), overrides: [{ appId: manifest.id, manifest, reason: "local" }] };
    }
  });

  assert.equal(requestedUrl, "http://localhost:4400/atlas.dev-session.json?hostId=host");
  assert.equal(overrides[0].manifest.remoteEntryUrl, "http://localhost:4201/remoteEntry.json");
});

test("missing local dev session leaves browser overrides empty", async () => {
  const overrides = await loadBrowserRuntimeOverrides({
    hostId: "host",
    allowCustomOverrides: true,
    search: "",
    storage: { getItem() { return null; } },
    sessionStorage: { getItem() { return null; } },
    async fetchJson() { throw new Error("No local Atlas dev session"); }
  });

  assert.deepEqual(overrides, []);
});

test("browser overrides cannot cross host boundaries", async () => {
  await assert.rejects(() => loadBrowserRuntimeOverrides({
    hostId: "host",
    allowCustomOverrides: true,
    search: "?atlas-override=http://localhost/override.json",
    storage: { getItem() { return null; } },
    async fetchJson() { return { schemaVersion: "1", hostId: "admin", generatedAt: "now", overrides: [] }; }
  }), /targets host "admin"/);
});

test("invalid browser overrides name the app and provide a Columbus recovery action", async () => {
  const manifest = createTestManifest({ id: "angular-app", version: "custom-url" });
  await assert.rejects(() => loadBrowserRuntimeOverrides({
    hostId: "host",
    allowCustomOverrides: true,
    search: "",
    storage: {
      getItem(key) {
        return key === ATLAS_OVERRIDE_DOCUMENT_STORAGE_KEY
          ? JSON.stringify({ schemaVersion: "1", hostId: "host", generatedAt: "now", overrides: [{ appId: manifest.id, manifest, reason: "local" }] })
          : null;
      }
    }
  }), /Invalid Atlas override for app "angular-app".*Suggested action: Open Columbus, correct or disable this app override/u);
});

test("browser overrides load a directly persisted extension document", async () => {
  const manifest = createTestManifest({ channel: "production", version: "0.8.0" });
  const overrides = await loadBrowserRuntimeOverrides({
    hostId: "host",
    allowCustomOverrides: true,
    search: "",
    storage: { getItem(key) { return key === ATLAS_OVERRIDE_DOCUMENT_STORAGE_KEY ? JSON.stringify({ schemaVersion: "1", hostId: "host", generatedAt: "now", overrides: [{ appId: manifest.id, manifest, reason: "historical" }] }) : null; } }
  });
  assert.equal(overrides[0].manifest.version, "0.8.0");
});

test("tab-scoped browser overrides take precedence over all-tab overrides", async () => {
  const production = createTestManifest({ id: "orders", version: "1.0.0" });
  const tab = createTestManifest({ id: "orders", version: "3.0.0", channel: "production" });
  const all = createTestManifest({ id: "orders", version: "2.0.0", channel: "production" });
  const documentFor = (manifest: AtlasManifest) => JSON.stringify({ schemaVersion: "1", hostId: "host", generatedAt: new Date().toISOString(), overrides: [{ appId: "orders", manifest, reason: "historical" }] });
  const overrides = await loadBrowserRuntimeOverrides({
    hostId: "host",
    allowCustomOverrides: true,
    storage: { getItem: (key) => key === "atlas.runtime-overrides" ? documentFor(all) : null },
    sessionStorage: { getItem: (key) => key === "atlas.runtime-overrides" ? documentFor(tab) : null }
  });
  const catalog = createHostCatalog([production]);
  assert.equal(resolveRuntimeManifests(catalog, overrides)[0].version, "3.0.0");
});

test("custom override URLs are disabled by default", async () => {
  let fetched = false;
  const overrides = await loadBrowserRuntimeOverrides({
    hostId: "host",
    search: "?atlas-override=https://attacker.example/override.json",
    storage: { getItem() { return null; } },
    async fetchJson() { fetched = true; throw new Error("must not fetch"); }
  });
  assert.deepEqual(overrides, []);
  assert.equal(fetched, false);
});

test("local override assets must use loopback URLs", () => {
  const selected = createTestManifest({ id: "catalog" });
  const replacement = createTestManifest({ id: "catalog", channel: "local", remoteEntryUrl: "http://192.168.1.20/remoteEntry.json" });
  const catalog = createHostCatalog([selected]);
  assert.throws(
    () => resolveRuntimeManifests(catalog, [{ appId: "catalog", manifest: replacement, reason: "local" }]),
    /must use loopback/
  );
});

test("widget loader mounts from the selected owner version", async () => {
  const widget: AtlasExportedWidgetManifest = { schemaVersion: "1", id: "product-count", name: "Product Count", ownerAppId: "catalog", framework: "react", remoteEntryUrl: "https://cdn.example/widget.js", expose: "./widgets/product-count", contractVersion: "1" };
  const manifest = createTestManifest({ exportedWidgets: [widget] });
  let request: AtlasExportedWidgetMountRequest | undefined;
  let unmounted = false;
  const loader = createWidgetLoader([manifest], createTestHostSdk(), {
    async importWidget() { return { mount(value) { request = value; return { unmount: () => { unmounted = true; } }; } }; }
  });
  assert.deepEqual(loader.list("catalog"), [widget]);
  const mounted = await loader.mount("catalog/product-count", createWidgetRendererContainer(), { count: 4 });
  if (!request) throw new Error("Widget was not mounted.");
  assert.deepEqual(request.props, { count: 4 });
  assert.equal(request.ownerManifest.version, "1.0.0");
  assert.equal(request.container.isConnected, true);
  await mounted.unmount();
  assert.equal(unmounted, true);
});

test("mounted widget forwards input updates to framework entry", async () => {
  const widget: AtlasExportedWidgetManifest = { schemaVersion: "1", id: "product-count", name: "Product Count", ownerAppId: "catalog", framework: "react", remoteEntryUrl: "https://cdn.example/widget.js", expose: "./widgets/product-count", contractVersion: "1" };
  const manifest = createTestManifest({ exportedWidgets: [widget] });
  const receivedInputs: object[] = [];
  const loader = createWidgetLoader([manifest], createTestHostSdk(), {
    async importWidget() {
      return {
        mount({ props }) {
          receivedInputs.push(props);
          return { setInputs(inputs) { receivedInputs.push(inputs); } };
        }
      };
    }
  });
  const mounted = await loader.mount(widget.id, createWidgetRendererContainer(), { count: 1 });

  mounted.setInputs?.({ count: 2 });

  assert.deepEqual(receivedInputs, [{ count: 1 }, { count: 2 }]);
  await mounted.unmount();
});

test("widget loader contains unresolved widget failure inside its mount card", async () => {
  const loader = createWidgetLoader([], createTestHostSdk());
  const mounted = await loader.mount("unknown/widget", createTestElement(), {});
  assert.equal(mounted.widget, undefined);
});

test("widget loader uses host-owned loading UI and clears it after mount", async () => {
  const widget: AtlasExportedWidgetManifest = { schemaVersion: "1", id: "product-count", name: "Product Count", ownerAppId: "catalog", framework: "react", remoteEntryUrl: "https://cdn.example/widget.js", expose: "./widgets/product-count", contractVersion: "1" };
  const manifest = createTestManifest({ exportedWidgets: [widget] });
  const events: string[] = [];
  const loader = createWidgetLoader([manifest], createTestHostSdk(), {
    async importWidget() { return { mount() {} }; },
    renderWidgetLoading(container, context) {
      events.push(`loading:${context.widget?.name}:${context.ownerManifest?.id}`);
      container.textContent = "Custom widget loading";
      return () => { events.push("loading-disposed"); };
    }
  });

  const mounted = await loader.mount(widget.id, createWidgetRendererContainer(), {});

  assert.deepEqual(events, ["loading:Product Count:catalog", "loading-disposed"]);
  await mounted.unmount();
});

test("widget getWidget loading renderer overrides host loading UI", async () => {
  const widget: AtlasExportedWidgetManifest = { schemaVersion: "1", id: "product-count", name: "Product Count", ownerAppId: "catalog", framework: "react", remoteEntryUrl: "https://cdn.example/widget.js", expose: "./widgets/product-count", contractVersion: "1" };
  const manifest = createTestManifest({ exportedWidgets: [widget] });
  const events: string[] = [];
  const loader = createWidgetLoader([manifest], createTestHostSdk(), {
    async importWidget() { return { mount() {} }; },
    renderWidgetLoading() {
      events.push("host-loading");
    }
  });

  const handle = loader.getWidget(widget.id, {
    renderLoading() {
      events.push("widget-loading");
      return () => { events.push("widget-loading-disposed"); };
    }
  });
  const mounted = await handle.mount(createWidgetRendererContainer(), {});

  assert.deepEqual(events, ["widget-loading", "widget-loading-disposed"]);
  await mounted.unmount();
});

test("widget loader uses host-owned error UI and disposes it on unmount", async () => {
  const events: string[] = [];
  let retry: (() => void) | undefined;
  const loader = createWidgetLoader([], createTestHostSdk(), {
    renderWidgetLoading(_container, context) {
      events.push(`loading:${context.widgetId}`);
      return () => { events.push("loading-disposed"); };
    },
    renderWidgetError(container, context, retryAction) {
      events.push(`error:${context.widgetId}:${context.error.message}`);
      container.textContent = "Custom widget error";
      retry = retryAction;
      return () => { events.push("error-disposed"); };
    }
  });

  const mounted = await loader.mount("unknown/widget", createWidgetRendererContainer(), {});

  assert.equal(typeof retry, "function");
  assert.deepEqual(events, [
    "loading:unknown/widget",
    "loading-disposed",
    'error:unknown/widget:Atlas exported widget "unknown/widget" is not available.'
  ]);
  await mounted.unmount();
  assert.equal(events.at(-1), "error-disposed");
});

test("widget retry remains owned by original mount lifecycle", async () => {
  const widget = new WidgetRetryDriver();
  await widget.start();
  await widget.retry();
  await widget.unmount();
  assert.equal(widget.remoteUnmounted, true);
});

test("duplicate widget ids warn and keep first selected match", async () => {
  const result = await duplicateWidgetResult();
  assert.equal(result.name, "First Widget");
  assert.match(result.warning, /multiple apps; using first match from "first"/);
});

test("duplicate registry widget ids warn and keep first match", async () => {
  const result = await duplicateRegistryWidgetResult();
  assert.equal(result.ownerId, "first");
  assert.match(result.warning, /multiple apps; using first match from "first"/);
});

test("widget registry resolves widgets from non-routed apps in the primary registry", async () => {
  const widgetId = "6f4994c1-b95f-4b24-a01a-106dd61aa4fb";
  const provider = widgetProvider("internal-provider", widgetId, "1.0.0");
  let requests = 0;
  const resolver = createRegistryWidgetResolver({
    runtimeConfig: { schemaVersion: "1", hostId: "host", catalogUrl: "https://platform.example/atlas/hosts/host/catalog.json" },
    catalog: createHostCatalog([]),
    async fetchJson(url) {
      requests += 1;
      assert.equal(url, "https://platform.example/atlas/registry.json");
      return widgetRegistry([provider]);
    }
  });

  assert.equal(requests, 0);
  assert.equal((await resolver(widgetId)).ownerManifest.id, "internal-provider");
  assert.equal(requests, 1);
  assert.equal((await resolver(widgetId)).ownerManifest.id, "internal-provider");
  assert.equal(requests, 1);
});

test("widget registry resolves declared external providers at their production selection", async () => {
  const widgetId = "98abc74d-a11f-4eca-8255-c6f2f49e3d6e";
  const oldProvider = widgetProvider("external-provider", widgetId, "1.0.0");
  const currentProvider = widgetProvider("external-provider", widgetId, "2.0.0");
  const consumer = createTestManifest({ externalAppsDependencies: ["external-provider"] });
  const resolver = createRegistryWidgetResolver({
    runtimeConfig: {
      schemaVersion: "1",
      hostId: "host",
      catalogUrl: "https://platform.example/atlas/hosts/host/catalog.json",
      externalRegistryUrls: ["https://external.example/atlas"]
    },
    catalog: createHostCatalog([consumer]),
    async fetchJson(url) {
      if (url.includes("platform.example")) return widgetRegistry([]);
      return widgetRegistry([oldProvider, currentProvider], { "external-provider": { version: "2.0.0", buildId: "build-2.0.0" } });
    }
  });

  assert.equal((await resolver(widgetId)).ownerManifest.version, "2.0.0");
});

test("failed external registry does not block a primary-registry widget", async () => {
  const widgetId = "6f4994c1-b95f-4b24-a01a-106dd61aa4fb";
  const consumer = createTestManifest({ externalAppsDependencies: ["external-provider"] });
  const resolver = createRegistryWidgetResolver({
    runtimeConfig: {
      schemaVersion: "1",
      hostId: "host",
      catalogUrl: "https://platform.example/atlas/hosts/host/catalog.json",
      externalRegistryUrls: ["https://offline.example/atlas"]
    },
    catalog: createHostCatalog([consumer]),
    async fetchJson(url) {
      if (url.includes("offline.example")) throw new Error("offline");
      return widgetRegistry([widgetProvider("internal-provider", widgetId, "1.0.0")]);
    }
  });

  assert.equal((await resolver(widgetId)).ownerManifest.id, "internal-provider");
});

test("widget registry retries after a transient registry failure", async () => {
  const registry = new WidgetRegistryDriver();
  await assert.rejects(() => registry.resolver(registry.widgetId), /temporary registry failure/);
  assert.equal((await registry.resolver(registry.widgetId)).ownerManifest.id, "internal-provider");
  assert.equal(registry.requests, 2);
});

test("page apps receive widget access through the SDK only", async () => {
  let received: AtlasAppContext | undefined;
  const sdk = createTestHostSdk();
  const widgetLoader = createWidgetLoader([], sdk);
  await mountApp({
    hostId: "host",
    catalogUrl: "",
    sdk,
    manifest: createTestManifest(),
    container: createTestElement(),
    widgetLoader,
    async importRemote() { return { mount({ context }) { received = context; } }; }
  });
  if (!received) throw new Error("App context was not received.");
  assert.equal("widgets" in received, false);
  assert.equal(sdk.getWidget("missing-widget").id, "missing-widget");
  assert.equal("components" in received, false);
});

test("page apps can update the host document title while mounted", async () => {
  const document = createStylesheetDocument([]);
  document.title = "Host";
  const mounted = await mountApp({
    hostId: "host",
    catalogUrl: "",
    sdk: createTestHostSdk(),
    manifest: createTestManifest(),
    container: createTestContainer(document),
    routeTitle: "Catalog",
    async importRemote() {
      return { mount({ context }) { context.route.setTabTitle("Order 42"); } };
    }
  });

  assert.equal(document.title, "Order 42");
  await mounted.unmount();
  assert.equal(document.title, "Host");
});

test("app mounts receive an Atlas-owned scoped DOM boundary", async () => {
  const document = createTestDocument();
  let removed = false;
  const boundary = createTestContainer(document);
  boundary.remove = () => { removed = true; };
  Object.defineProperty(document, "createElement", { value: () => boundary });
  const parent = createTestContainer(document);
  let child: HTMLElement | undefined;
  parent.append = () => { child = boundary; };
  let receivedContainer: HTMLElement | undefined;
  const mounted = await mountApp({
    hostId: "host",
    catalogUrl: "",
    sdk: createTestHostSdk(),
    manifest: createTestManifest({ id: "map", isolation: "scoped" }),
    container: parent,
    async importRemote() { return { mount({ container }) { receivedContainer = container; } }; }
  });
  if (!receivedContainer) throw new Error("App boundary was not received.");
  assert.equal(child, receivedContainer);
  assert.equal(receivedContainer.dataset.atlasApp, "map");
  await mounted.unmount();
  assert.equal(removed, true);
});

test("remote asset URLs resolve against the owning app remote entry", () => {
  const manifest = createTestManifest({
    remoteEntryUrl: "http://localhost:4202/apps/catalog/remoteEntry.json"
  });

  assert.equal(
    rewriteAssetUrl("/assets/images/image.JPG", manifest),
    "http://localhost:4202/assets/images/image.JPG"
  );
  assert.equal(
    rewriteAssetUrl("assets/images/image.JPG", manifest),
    "http://localhost:4202/apps/catalog/assets/images/image.JPG"
  );
  assert.equal(
    rewriteAssetUrl("https://cdn.example/image.JPG", manifest),
    "https://cdn.example/image.JPG"
  );
});

test("remote CSS asset URLs resolve against the owning app remote entry", () => {
  const manifest = createTestManifest({ remoteEntryUrl: "http://localhost:4202/remoteEntry.json" });
  const css = ".hero{background:url('/assets/images/image.JPG')} .icon{mask:url(\"assets/icon.svg\")}";

  assert.equal(
    rewriteCssAssetUrls(css, manifest),
    ".hero{background:url('http://localhost:4202/assets/images/image.JPG')} .icon{mask:url(\"http://localhost:4202/assets/icon.svg\")}"
  );
});

test("remote asset URLs are rewritten before inserted nodes enter the host document", () => {
  const manifest = createTestManifest({ remoteEntryUrl: "http://localhost:4202/remoteEntry.json" });
  const image = createAssetElement("img", { src: "/assets/images/image.jpg" });
  const wrapper = createAssetElement("div", {}, [image]);
  const boundary = createAssetElement("div");
  let appendedSrc: string | null | undefined;
  boundary.append = (node) => {
    if (!isTestAssetElement(node)) return;
    boundary.testChildren.push(node);
    appendedSrc = node.querySelectorAll("*")[0]?.getAttribute("src");
  };

  const release = startRemoteAssetRewrite(manifest, boundary, undefined);
  boundary.append(wrapper);
  release();

  assert.equal(appendedSrc, "http://localhost:4202/assets/images/image.jpg");
});

test("host loads app styles before mount and releases them after the final unmount", async () => {
  const events: string[] = [];
  const document = createStylesheetDocument(events);
  const container = createTestContainer(document);
  const manifest = createTestManifest({ styles: [{ href: "https://cdn.example/catalog/styles.css", integrity: "sha256-valid" }] });
  const options = {
    hostId: "host",
    catalogUrl: "",
    sdk: createTestHostSdk(),
    manifest,
    container,
    async importRemote() { events.push("import"); return { mount() { events.push("mount"); } }; }
  };

  const first = await mountApp(options);
  const second = await mountApp(options);
  assert.deepEqual(events.slice(0, 3), ["style", "import", "mount"]);
  assert.equal(document.testLinks.length, 1);
  assert.equal(document.testLinks[0]?.crossOrigin, "anonymous");
  await first.unmount();
  assert.equal(document.testLinks[0]?.removed, undefined);
  await second.unmount();
  assert.equal(document.testLinks[0]?.removed, true);
});

test("stylesheet failures prevent remote mounting", async () => {
  const document = createStylesheetDocument([], "error");
  let imported = false;
  await assert.rejects(() => mountApp({
    hostId: "host",
    catalogUrl: "",
    sdk: createTestHostSdk(),
    manifest: createTestManifest({ styles: [{ href: "https://cdn.example/catalog/missing.css", integrity: "sha256-valid" }] }),
    container: createTestContainer(document),
    async importRemote() { imported = true; return { mount() {} }; }
  }), /could not load stylesheet/);
  assert.equal(imported, false);
});

test("stylesheet trust rejects unsupported protocols before import", async () => {
  let imported = false;
  const base = {
    hostId: "host",
    catalogUrl: "",
    sdk: createTestHostSdk(),
    container: createTestContainer(createStylesheetDocument([])),
    async importRemote() { imported = true; return { mount() {} }; }
  };
  await assert.rejects(
    () => mountApp({ ...base, manifest: createTestManifest({ remoteEntryUrl: "https://cdn.example/entry.js", styles: [{ href: "ftp://cdn.example/styles.css" }] }) }),
    /unsupported stylesheet protocol/
  );
  assert.equal(imported, false);
});

test("host runtime mounts only the active route and unmounts during navigation", async () => {
  const unmounted: string[] = [];
  const driver = new HostRuntimeDriver()
    .given.manifests([createRouteManifest("catalog", "/catalog"), createRouteManifest("details", "/catalog/details")])
    .given.remote(async (manifest) => ({ mount: () => ({ unmount: () => { unmounted.push(manifest.id); } }) }));

  await driver.when.started();
  assert.deepEqual(driver.states, []);
  await driver.when.navigatedTo("/catalog");
  await driver.when.navigatedTo("/catalog/details/42");

  assert.ok(unmounted.includes("catalog"));
  assert.deepEqual(driver.imports, ["catalog", "details"]);
  await driver.when.stopped();
  assert.ok(unmounted.includes("details"));
});

test("host runtime renders the first exact route and logs duplicate routes", async () => {
  const route = (id: string, basePath: string): AtlasPlacement[] => [createRoutePlacement(id, basePath)];
  const states: AtlasHostMountEvent[] = [];
  const imported: string[] = [];
  const sdk = createTestHostSdk();
  const errors: unknown[] = [];
  const originalError = console.error;
  console.error = (message) => errors.push(message);
  try {
    const runtime = await startAtlasHostRuntime({
      hostId: "host",
      manifests: [
        createTestManifest({ id: "first", placements: route("first", "/orders") }),
        createTestManifest({ id: "second", placements: route("second", "/orders/") }),
        createTestManifest({ id: "catalog", placements: route("catalog", "/catalog") })
      ],
      sdk,
      resolveRouteContainer() { return createTestElement(); },
      resolveSlotContainer() { return undefined; },
      onMountStateChange(event) { states.push(event); },
      async importRemote(manifest) {
        imported.push(manifest.id);
        return { mount() {} };
      }
    });

    assert.match(String(errors[0]), /ignored duplicate route basePath "\/orders" from app "second"/);
    assert.match(String(errors[0]), /each hostId can use a basePath only once/);
    assert.deepEqual(states, []);
    sdk.navigation.navigate("/orders");
    await tick();
    sdk.navigation.navigate("/catalog");
    await tick();
    assert.deepEqual(imported, ["first", "catalog"]);
    await runtime.stop();
  } finally {
    console.error = originalError;
  }
});

test("host runtime mounts slots independently and reports remote failures", async () => {
  const driver = new HostRuntimeDriver()
    .given.manifests([createSlotManifest("widget", "header")])
    .given.remote(async () => { throw new Error("CDN unavailable"); });

  await driver.when.started();

  assert.deepEqual(driver.states, ["mounting", "error"]);
  assert.match(driver.lastError?.message ?? "", /CDN unavailable/);
  await driver.when.stopped();
});

test("DOM host warns and skips app import when a declared slot is missing", async () => {
  const widget = createTestManifest({ id: "widget", placements: [{ id: "header-widget", kind: "slot", hostId: "host", slot: "header" }] });
  const warnings: unknown[] = [];
  let imported = false;
  const originalWarn = console.warn;
  console.warn = (message) => warnings.push(message);
  try {
    const document = createTestDocument();
    document.querySelector = () => null;
    document.dispatchEvent = () => true;
    const runtime = await startDomHostRuntime({
      options: {
        runtimeConfig: { schemaVersion: "1", hostId: "host", catalogUrl: catalogDataUrl([widget]) },
        federation: {
          async initFederation() {},
          async loadRemoteModule() { imported = true; return { mount() {} }; }
        }
      },
      services: { createNavigation: () => createTestHostSdk().navigation },
      document,
      onInfrastructureReady() {}
    });

    assert.equal(imported, false);
    assert.match(String(warnings[0]), /does not contain \[data-atlas-slot="header"\]/);
    await runtime.stop();
  } finally {
    console.warn = originalWarn;
  }
});

test("host runtime starts independent slots concurrently", async () => {
  const bothImportsStarted = createDeferred();
  let activeImports = 0;
  const driver = new HostRuntimeDriver()
    .given.manifests([createSlotManifest("first"), createSlotManifest("second")])
    .given.remote(async () => {
      activeImports += 1;
      if (activeImports === 2) bothImportsStarted.resolve();
      await bothImportsStarted.promise;
      return { mount() {} };
    });

  await driver.when.started();

  assert.equal(activeImports, 2);
  await driver.when.stopped();
});

test("host runtime cleans up mounts that finish after their timeout", async () => {
  const widget = createTestManifest({ id: "late", placements: [{ id: "late-slot", kind: "slot", hostId: "host", slot: "late" }] });
  let unmounted = 0;
  const runtime = await startAtlasHostRuntime({
    hostId: "host",
    manifests: [widget],
    sdk: createTestHostSdk(),
    resourcesTimeoutMs: 2,
    resolveRouteContainer() { return undefined; },
    resolveSlotContainer() { return createTestElement(); },
    async importRemote() {
      return { async mount() { await new Promise((resolve) => setTimeout(resolve, 10)); return { unmount() { unmounted += 1; } }; } };
    }
  });
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(unmounted, 1);
  await runtime.stop();
});

test("host runtime coalesces overlapping retries for one failed placement", async () => {
  const retryImport = createDeferred();
  const driver = new HostRuntimeDriver()
    .given.manifests([createSlotManifest("retry")])
    .given.resourcesTimeout(2)
    .given.remote(async () => {
      if (driver.imports.length === 1) return new Promise(() => undefined);
      retryImport.resolve();
      return { mount() {} };
    });

  await driver.when.started();
  await driver.when.retriedTogether("retry");
  await retryImport.promise;

  assert.equal(driver.imports.length, 2);
  await driver.when.stopped();
});

test("host runtime shows loading UI only when requested by the app", async () => {
  const driver = new HostRuntimeDriver()
    .given.manifests([createSlotManifest("widget", "header")])
    .given.remote(async () => ({ mount: ({ context }) => context.loading.show() }));

  await driver.when.started();

  assert.deepEqual(driver.states, ["mounting", "loading", "mounted"]);
  await driver.when.stopped();
});

test("host runtime renders no loading state when the app does not request one", async () => {
  const driver = new HostRuntimeDriver().given.manifests([createSlotManifest("widget", "header")]);

  await driver.when.started();

  assert.deepEqual(driver.states, ["mounting", "mounted"]);
  await driver.when.stopped();
});

test("host runtime reports and cleans up an app that opts into readiness but never becomes ready", async () => {
  const widget = createTestManifest({ id: "widget", placements: [{ id: "header-widget", kind: "slot", hostId: "host", slot: "header" }] });
  const states: AtlasHostMountEvent[] = [];
  let unmounted = false;
  const runtime = await startAtlasHostRuntime({
    hostId: "host",
    manifests: [widget],
    sdk: createTestHostSdk(),
    resourcesTimeoutMs: 5,
    resolveRouteContainer() { return undefined; },
    resolveSlotContainer() { return createTestElement(); },
    onMountStateChange(event) { states.push(event); },
    async importRemote() { return { mount({ context }) { context.loading.waitUntilReady(); return { unmount() { unmounted = true; } }; } }; }
  });
  assert.equal(unmounted, true);
  assert.deepEqual(states.map(({ state }) => state), ["mounting", "loading", "error"]);
  assert.match(states[2]?.error?.message ?? "", /did not mark itself ready/);
  await runtime.stop();
});

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function catalogDataUrl(manifests: AtlasManifest[]): string {
  const catalog = createHostCatalog(manifests);
  return `data:application/json,${encodeURIComponent(JSON.stringify(catalog))}`;
}

interface TestAssetElement extends HTMLElement {
  testChildren: TestAssetElement[];
}

function createAssetElement(tagName: string, initialAttributes: Record<string, string> = {}, children: TestAssetElement[] = []): TestAssetElement {
  const element: TestAssetElement = Object.create(null);
  const attributes = new Map(Object.entries(initialAttributes));
  element.testChildren = [...children];
  Object.defineProperty(element, "nodeType", { value: 1 });
  Object.defineProperty(element, "tagName", { value: tagName.toUpperCase() });
  element.getAttribute = (name) => attributes.get(name) ?? null;
  element.setAttribute = (name, value) => { attributes.set(name, value); };
  Object.defineProperty(element, "querySelectorAll", { value: () => element.testChildren.flatMap((child) => [child, ...Array.from(child.querySelectorAll("*"))]) });
  element.append = (...nodes) => { element.testChildren.push(...nodes.filter(isTestAssetElement)); };
  element.prepend = (...nodes) => { element.testChildren.unshift(...nodes.filter(isTestAssetElement)); };
  element.appendChild = (node) => { if (isTestAssetElement(node)) element.testChildren.push(node); return node; };
  element.insertBefore = (node) => { if (isTestAssetElement(node)) element.testChildren.push(node); return node; };
  element.replaceChild = (node, oldNode) => {
    if (!isTestAssetElement(node) || !isTestAssetElement(oldNode)) return oldNode;
    const index = element.testChildren.indexOf(oldNode);
    if (index === -1) element.testChildren.push(node); else element.testChildren[index] = node;
    return oldNode;
  };
  element.replaceChildren = (...nodes) => { element.testChildren = nodes.filter(isTestAssetElement); };
  return element;
}

function isTestAssetElement(value: unknown): value is TestAssetElement {
  return typeof value === "object" && value !== null && "testChildren" in value && Array.isArray(value.testChildren);
}

interface TestStyleLink extends HTMLLinkElement {
  removed?: boolean;
  testListeners: Partial<Record<"load" | "error", EventListener>>;
}

type TestStylesheetDocument = Document & { testLinks: TestStyleLink[] };

function createStylesheetDocument(events: string[], outcome: "load" | "error" = "load"): TestStylesheetDocument {
  const document: TestStylesheetDocument = Object.create(null);
  document.testLinks = [];
  const head = createTestElement();
  head.append = (node) => {
    if (!isTestStyleLink(node)) return;
    const link = node;
    document.testLinks.push(link);
    events.push("style");
    queueMicrotask(() => link.testListeners[outcome]?.(new Event(outcome)));
  };
  Object.defineProperty(document, "head", { value: head });
  Object.defineProperty(document, "createElement", { value: (tag: string) => {
    if (tag !== "link") return createTestContainer(document);
    const link: TestStyleLink = Object.create(null);
    Object.defineProperty(link, "dataset", { value: {} });
    link.testListeners = {};
    link.addEventListener = (name: string, listener: EventListenerOrEventListenerObject) => {
      if ((name === "load" || name === "error") && typeof listener === "function") link.testListeners[name] = listener;
    };
    link.remove = () => { link.removed = true; };
    return link;
  } });
  return document;
}

function isTestStyleLink(value: unknown): value is TestStyleLink {
  return typeof value === "object" && value !== null && "testListeners" in value;
}

function createHostStatusContainer() {
  const element = createTestElement();
  const attributes = new Map<string, string>();
  element.textContent = "";
  element.getAttribute = (name) => attributes.get(name) ?? null;
  element.setAttribute = (name, value) => { attributes.set(name, value); };
  element.removeAttribute = (name) => { attributes.delete(name); };
  element.replaceChildren = (...children) => {
    element.textContent = children.map((child) => typeof child === "string" ? child : child.textContent ?? "").join("");
  };
  return element;
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
    hostId: "host",
    catalogUrl: "https://registry.example.com/atlas/hosts/host/catalog.json",
    allowAppOverrides: true,
    resourcesTimeoutMs: 15000,
    resourcesRetryCount: 3
  }));
  const policy = createRemoteTrustPolicy(config);
  assert.deepEqual([...(policy.allowedOrigins ?? [])], ["https://registry.example.com"]);
});

test("runtime config rejects invalid resource settings", async () => {
  await assert.rejects(
    () => loadHostRuntimeConfig("/atlas.runtime.json", async () => ({
      schemaVersion: "1",
      hostId: "host",
      catalogUrl: "https://registry.example.com/catalog.json",
      resourcesRetryCount: -1
    })),
    /resourcesRetryCount/
  );
});

test("federation isolates rejected remotes while trusted apps remain loadable", async () => {
  const rejected = createTestManifest({ id: "rejected", remoteEntryUrl: "https://assets.example.com/rejected.json" });
  const local = createTestManifest({ id: "local", channel: "local", remoteEntryUrl: "http://localhost:4201/remoteEntry.json" });
  const initialized: string[] = [];
  const federation = await createTrustedNativeFederationImporters({
    async initFederation(remotes) { initialized.push(...Object.keys(remotes)); },
    async loadRemoteModule() { return { mount() {} }; }
  }, [rejected, local], {});

  assert.deepEqual(initialized, ["atlas_rejected", "atlas_local"]);
  assert.equal(typeof (await federation.importRemote(rejected)).mount, "function");
  assert.equal(typeof (await federation.importRemote(local)).mount, "function");
});
