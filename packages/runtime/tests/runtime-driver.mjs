import { createTestHostSdk, createTestManifest } from "../../testkit/dist/index.js";
import { startAtlasHostRuntime } from "../dist/index.js";

const hostId = "host";

export function createRouteManifest(id, basePath) {
  return createTestManifest({
    id,
    placements: [{ id: `${id}-route`, kind: "route", hostId, route: { basePath, title: id } }]
  });
}

export function createSlotManifest(id, slot = id) {
  return createTestManifest({
    id,
    placements: [{ id: `${id}-slot`, kind: "slot", hostId, slot }]
  });
}

export function createDeferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

export class HostRuntimeDriver {
  #importRemote = async () => ({ mount() {} });
  #manifests = [];
  #resourcesTimeoutMs;
  #runtime;
  #sdk = createTestHostSdk();
  #stateWaiters = [];

  events = [];
  imports = [];

  given = {
    manifests: (manifests) => {
      this.#manifests = manifests;
      return this;
    },
    remote: (importRemote) => {
      this.#importRemote = importRemote;
      return this;
    },
    resourcesTimeout: (resourcesTimeoutMs) => {
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
        resolveRouteContainer: () => ({}),
        resolveSlotContainer: () => ({}),
        onStateChange: (event) => this.#recordState(event),
        importRemote: async (manifest) => {
          this.imports.push(manifest.id);
          return this.#importRemote(manifest);
        }
      });
      return this;
    },
    navigatedTo: async (path, expectedState = "mounted") => {
      const state = this.#waitForState((event) => event.state === expectedState);
      this.#sdk.navigation.navigate(path);
      await state;
      return this;
    },
    retriedTogether: async (appId) => {
      await Promise.all([this.#runtime.retry(appId), this.#runtime.retry(appId)]);
      return this;
    },
    stopped: async () => {
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

  #recordState(event) {
    this.events.push(event);
    const matchingWaiters = this.#stateWaiters.filter(({ matches }) => matches(event));
    this.#stateWaiters = this.#stateWaiters.filter(({ matches }) => !matches(event));
    for (const { resolve } of matchingWaiters) resolve(event);
  }

  #waitForState(matches) {
    return new Promise((resolve) => this.#stateWaiters.push({ matches, resolve }));
  }
}
