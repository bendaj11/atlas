import { createTestHostSdk, createTestManifest } from "../../testkit/dist/index.js";
import { startAtlasHostRuntime } from "../dist/index.js";
import type { AtlasAppEntry } from "../../sdk/dist/lifecycle.js";
import type { AtlasHostCatalog, AtlasManifest, AtlasPlacement } from "../../schema/dist/index.js";
import type { AtlasHostMountEvent, AtlasHostMountState, AtlasHostRuntime } from "../dist/index.js";

const hostId = "host";

export function createHostCatalog(manifests: AtlasManifest[], selectedHostId = hostId): AtlasHostCatalog {
  return { schemaVersion: "1", hostId: selectedHostId, generatedAt: "2026-01-01T00:00:00.000Z", manifests };
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
        onStateChange: (event) => this.#recordState(event),
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
