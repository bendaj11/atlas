import { createTestHostSdk, createTestManifest } from "../../testkit/dist/index.js";
import { createRegistryWidgetResolver, createWidgetLoader, startAtlasHostRuntime } from "../dist/index.js";
import type { AtlasAppEntry, AtlasMountedWidget } from "../../sdk/dist/lifecycle.js";
import type { AtlasExportedWidgetManifest, AtlasHostCatalog, AtlasHostManifest, AtlasManifest, AtlasPlacement, AtlasProductionSelection, AtlasStaticRegistry } from "../../schema/dist/index.js";
import type { AtlasHostMountEvent, AtlasHostMountState, AtlasHostRuntime } from "../dist/index.js";

const hostId = "host";

export function createHostCatalog(manifests: AtlasManifest[], selectedHostId = hostId): AtlasHostCatalog {
  return {
    schemaVersion: "1",
    hostId: selectedHostId,
    revision: "sha256:test",
    generatedAt: "2026-01-01T00:00:00.000Z",
    host: testHostManifest(selectedHostId),
    apps: manifests
  };
}

function testHostManifest(id: string): AtlasHostManifest {
  return {
    schemaVersion: "1", kind: "host", id, name: id, version: "1.0.0", buildId: "host",
    channel: "production", framework: "react", remoteEntryUrl: "https://cdn.example/host/remoteEntry.json",
    exposes: { entry: "./host" }, requiredLoaderApiVersion: "^1.0.0", createdAt: "2026-01-01T00:00:00.000Z"
  };
}

export function createRoutePlacement(id: string, basePath: string): AtlasPlacement {
  return { id: `${id}-route`, kind: "route", hostId, route: { basePath, title: id } };
}

export function createTestDocument(): Document {
  return Object.create(null);
}

export function createTestElement(): HTMLElement {
  const element: HTMLElement = Object.create(null);
  Object.defineProperty(element, "dataset", { value: {} });
  return element;
}

export function createTestContainer(document: Document = createTestDocument()): HTMLElement {
  const element = createTestElement();
  Object.defineProperty(element, "ownerDocument", { value: document });
  element.append = () => undefined;
  element.remove = () => undefined;
  return element;
}

export function createWidgetRendererContainer(): HTMLElement {
  const document: Document = Object.create(null);
  const connected = new WeakMap<HTMLElement, boolean>();
  const createElement = (): HTMLElement => {
    const element: HTMLElement = Object.create(null);
    const elementChildren = new Set<HTMLElement>();
    connected.set(element, false);
    Object.defineProperty(element, "dataset", { value: {} });
    Object.defineProperty(element, "isConnected", { get: () => connected.get(element) ?? false });
    Object.defineProperty(element, "ownerDocument", { value: document });
    element.append = (...nodes) => {
      for (const node of nodes) {
        if (typeof node !== "object" || node === null || !("dataset" in node)) continue;
        const child = node as HTMLElement;
        elementChildren.add(child);
        connected.set(child, connected.get(element) ?? false);
      }
    };
    element.replaceChildren = (...nodes) => {
      for (const child of elementChildren) connected.set(child, false);
      elementChildren.clear();
      element.append(...nodes);
    };
    element.remove = () => { connected.set(element, false); };
    element.setAttribute = () => undefined;
    return element;
  };
  Object.defineProperty(document, "createElement", { value: createElement });
  const root = createElement();
  connected.set(root, true);
  return root;
}

export class WidgetRetryDriver {
  #mounted: AtlasMountedWidget | undefined;
  #remoteMounted: Promise<void>;
  #resolveRemoteMounted!: () => void;
  #retry: (() => void) | undefined;
  #unmounted = false;

  constructor() {
    this.#remoteMounted = new Promise((resolve) => { this.#resolveRemoteMounted = resolve; });
  }

  async start(): Promise<void> {
    const widget = widgetManifest("catalog", "6f4994c1-b95f-4b24-a01a-106dd61aa4fb", "Product Count");
    const manifest = createTestManifest({ id: "catalog", exportedWidgets: [widget] });
    let attempts = 0;
    const loader = createWidgetLoader([manifest], createTestHostSdk(), {
      importWidget: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("temporary import failure");
        return {
          mount: () => {
            this.#resolveRemoteMounted();
            return { unmount: () => { this.#unmounted = true; } };
          }
        };
      },
      renderWidgetError: (_container, _context, retry) => { this.#retry = retry; }
    });
    this.#mounted = await loader.mount(widget.id, createWidgetRendererContainer(), {});
  }

  async retry(): Promise<void> {
    if (!this.#retry) throw new Error("Widget retry was not available.");
    this.#retry();
    await this.#remoteMounted;
  }

  async unmount(): Promise<void> {
    await this.#mounted?.unmount();
  }

  get remoteUnmounted(): boolean {
    return this.#unmounted;
  }
}

export async function duplicateWidgetResult(): Promise<{ name: string; warning: string }> {
  const widgetId = "6f4994c1-b95f-4b24-a01a-106dd61aa4fb";
  const first = createTestManifest({ id: "first", exportedWidgets: [widgetManifest("first", widgetId, "First Widget")] });
  const second = createTestManifest({ id: "second", exportedWidgets: [widgetManifest("second", widgetId, "Second Widget")] });
  const originalWarn = console.warn;
  let warning = "";
  try {
    console.warn = (message?: unknown) => { warning = String(message); };
    const widget = await createWidgetLoader([first, second], createTestHostSdk()).getWidget(widgetId);
    return { name: widget.name, warning };
  } finally {
    console.warn = originalWarn;
  }
}

export async function duplicateRegistryWidgetResult(): Promise<{ ownerId: string; warning: string }> {
  const widgetId = "6f4994c1-b95f-4b24-a01a-106dd61aa4fb";
  const first = widgetProvider("first", widgetId, "1.0.0");
  const second = widgetProvider("second", widgetId, "1.0.0");
  const originalWarn = console.warn;
  let warning = "";
  try {
    console.warn = (message?: unknown) => { warning = String(message); };
    const resolver = createRegistryWidgetResolver({
      runtimeConfig: { schemaVersion: "1", hostId: "host", catalogUrl: "https://platform.example/atlas/hosts/host/catalog.json" },
      catalog: createHostCatalog([]),
      fetchJson: async () => widgetRegistry([first, second])
    });
    return { ownerId: (await resolver(widgetId)).ownerManifest.id, warning };
  } finally {
    console.warn = originalWarn;
  }
}

export class WidgetRegistryDriver {
  requests = 0;
  readonly widgetId = "6f4994c1-b95f-4b24-a01a-106dd61aa4fb";
  readonly resolver = createRegistryWidgetResolver({
    runtimeConfig: { schemaVersion: "1", hostId: "host", catalogUrl: "https://platform.example/atlas/hosts/host/catalog.json" },
    catalog: createHostCatalog([]),
    fetchJson: async () => {
      this.requests += 1;
      if (this.requests === 1) throw new Error("temporary registry failure");
      return widgetRegistry([widgetProvider("internal-provider", this.widgetId, "1.0.0")]);
    }
  });
}

export function widgetProvider(appId: string, widgetId: string, version: string): AtlasManifest {
  return createTestManifest({
    id: appId,
    version,
    buildId: `build-${version}`,
    placements: [],
    exportedWidgets: [widgetManifest(appId, widgetId, "Test Widget", version)]
  });
}

export function widgetRegistry(
  apps: AtlasManifest[],
  selections: Record<string, AtlasProductionSelection> = {}
): AtlasStaticRegistry {
  return {
    schemaVersion: "1",
    updatedAt: "2026-01-01T00:00:00.000Z",
    hosts: [],
    apps,
    selections: { hosts: {}, apps: selections }
  };
}

function widgetManifest(
  appId: string,
  widgetId: string,
  name: string,
  version = "1.0.0"
): AtlasExportedWidgetManifest {
  return {
    schemaVersion: "1",
    id: widgetId,
    name,
    ownerAppId: appId,
    framework: "react",
    remoteEntryUrl: `https://assets.example/${appId}/${version}/remoteEntry.json`,
    expose: "./widgets/test",
    contractVersion: "1"
  };
}

export function createRouteManifest(id: string, basePath: string): AtlasManifest {
  return createTestManifest({
    id,
    placements: [{ id: `${id}-route`, kind: "route", hostId, route: { basePath, title: id } }]
  });
}

export function createSlotManifest(id: string, slot = id): AtlasManifest {
  return createTestManifest({
    id,
    placements: [{ id: `${id}-slot`, kind: "slot", hostId, slot }]
  });
}

export function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

export class HostRuntimeDriver {
  #importRemote: (manifest: AtlasManifest) => Promise<AtlasAppEntry> = async () => ({ mount() {} });
  #manifests: AtlasManifest[] = [];
  #resourcesTimeoutMs: number | undefined;
  #runtime: AtlasHostRuntime | undefined;
  #sdk = createTestHostSdk();
  #stateWaiters: Array<{ matches: (event: AtlasHostMountEvent) => boolean; resolve: (event: AtlasHostMountEvent) => void }> = [];

  events: AtlasHostMountEvent[] = [];
  imports: string[] = [];

  given = {
    manifests: (manifests: AtlasManifest[]) => {
      this.#manifests = manifests;
      return this;
    },
    remote: (importRemote: (manifest: AtlasManifest) => Promise<AtlasAppEntry>) => {
      this.#importRemote = importRemote;
      return this;
    },
    resourcesTimeout: (resourcesTimeoutMs: number) => {
      this.#resourcesTimeoutMs = resourcesTimeoutMs;
      return this;
    }
  };

  when = {
    started: async () => {
      this.#runtime = await startAtlasHostRuntime({
        hostId,
        manifests: this.#manifests,
        sdk: this.#sdk,
        resourcesTimeoutMs: this.#resourcesTimeoutMs,
        resolveRouteContainer: () => Object.create(null),
        resolveSlotContainer: () => Object.create(null),
        onMountStateChange: (event) => this.#recordState(event),
        importRemote: async (manifest) => {
          this.imports.push(manifest.id);
          return this.#importRemote(manifest);
        }
      });
      return this;
    },
    navigatedTo: async (path: string, expectedState: AtlasHostMountState = "mounted") => {
      const state = this.#waitForState((event) => event.state === expectedState);
      this.#sdk.navigation.navigate(path);
      await state;
      return this;
    },
    retriedTogether: async (appId: string) => {
      if (!this.#runtime) throw new Error("Host runtime has not started.");
      await Promise.all([this.#runtime.retry(appId), this.#runtime.retry(appId)]);
      return this;
    },
    stopped: async () => {
      if (!this.#runtime) throw new Error("Host runtime has not started.");
      await this.#runtime.stop();
      return this;
    }
  };

  get states() {
    return this.events.map(({ state }) => state);
  }

  get lastError() {
    return this.events.at(-1)?.error;
  }

  #recordState(event: AtlasHostMountEvent): void {
    this.events.push(event);
    const matchingWaiters = this.#stateWaiters.filter(({ matches }) => matches(event));
    this.#stateWaiters = this.#stateWaiters.filter(({ matches }) => !matches(event));
    for (const { resolve } of matchingWaiters) resolve(event);
  }

  #waitForState(matches: (event: AtlasHostMountEvent) => boolean): Promise<AtlasHostMountEvent> {
    return new Promise((resolve) => this.#stateWaiters.push({ matches, resolve }));
  }
}
