import { afterEach, expect, test } from "@jest/globals";
import type {} from "../src/chrome.js";
import type { AtlasHostData } from "../src/contracts.js";
import { readHostData } from "../src/popup/atlas-host.js";

const hostId = "060a7f62-1c95-402c-9993-55749faf36d9";
const hostData = createHostData(hostId, true);

afterEach(() => {
  Reflect.deleteProperty(globalThis, "chrome");
});

test("reads the active Atlas preview tab", async () => {
  installChromeMock({
    tabs: [{ id: 7, active: true, url: "http://127.0.0.1:4300/orders" }],
    inspections: new Map([[7, hostData]])
  });

  const result = await readHostData(undefined);

  expect(result.tabId).toBe(7);
});

test("finds an open local preview when an app framework tab is active", async () => {
  installChromeMock({
    tabs: [
      { id: 8, active: true, lastAccessed: 20, url: "http://localhost:4201/" },
      { id: 7, active: false, lastAccessed: 10, url: "http://127.0.0.1:4300/orders" }
    ],
    inspections: new Map([[7, hostData]])
  });

  const result = await readHostData(undefined);

  expect(result.tabId).toBe(7);
});

test("does not scan other tabs from a non-local page", async () => {
  installChromeMock({
    tabs: [
      { id: 8, active: true, url: "https://example.com/" },
      { id: 7, active: false, url: "http://127.0.0.1:4300/orders" }
    ],
    inspections: new Map([[7, hostData]])
  });

  await expect(readHostData(undefined)).rejects.toThrow("No Atlas runtime");
});

test("rejects ambiguous local preview tabs", async () => {
  installChromeMock({
    tabs: [
      { id: 9, active: true, url: "http://localhost:4201/" },
      { id: 8, active: false, url: "http://localhost:4301/orders" },
      { id: 7, active: false, url: "http://localhost:4300/orders" }
    ],
    inspections: new Map([
      [8, createHostData("399e1a5d-f83d-4248-96ed-e4211707ae1b", true)],
      [7, hostData]
    ])
  });

  await expect(readHostData(undefined)).rejects.toThrow("Multiple local Atlas previews are open");
});

interface ChromeMockOptions {
  tabs: MockTab[];
  inspections: Map<number, AtlasHostData>;
}

interface MockTab {
  active?: boolean;
  id?: number;
  lastAccessed?: number;
  url?: string;
}

function installChromeMock(options: ChromeMockOptions): void {
  const localStorage = new Map<string, unknown>();
  const chromeMock = {
    tabs: {
      query: async () => options.tabs,
      reload: async () => undefined
    },
    scripting: {
      executeScript: async ({ target }: { target: { tabId: number } }) => {
        const result = options.inspections.get(target.tabId);
        if (!result) throw new Error("No Atlas runtime");
        return [{ result }];
      }
    },
    storage: {
      local: {
        get: async (key: string) => ({ [key]: localStorage.get(key) }),
        remove: async (key: string) => { localStorage.delete(key); },
        set: async (items: Record<string, unknown>) => { Object.entries(items).forEach(([key, value]) => localStorage.set(key, value)); }
      }
    },
    action: {
      setBadgeBackgroundColor: async () => undefined,
      setBadgeTextColor: async () => undefined,
      setBadgeText: async () => undefined
    }
  };
  Object.assign(globalThis, { chrome: chromeMock });
}

function createHostData(id: string, allowOverrides: boolean): AtlasHostData {
  const host = {
    schemaVersion: "1" as const,
    kind: "host" as const,
    id,
    name: "Test Host",
    version: "1.0.0",
    buildId: "host-build",
    channel: "production" as const,
    framework: "react" as const,
    remoteEntryUrl: "http://127.0.0.1:4200/remoteEntry.json"
  };
  return {
    config: {
      schemaVersion: "1",
      hostId: id,
      catalogUrl: `http://127.0.0.1:4400/hosts/${id}/catalog.json`,
      allowOverrides
    },
    pageUrl: "http://127.0.0.1:4300/",
    catalog: { schemaVersion: "1", hostId: id, revision: "test", host, apps: [] },
    versions: { [`host:${id}`]: [host] },
    overrides: undefined,
    overrideScope: undefined,
    runtimeErrors: [],
    versionErrors: []
  };
}
