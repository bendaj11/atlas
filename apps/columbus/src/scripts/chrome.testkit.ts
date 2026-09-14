export interface FakeTab {
  active?: boolean;
  id?: number;
  lastAccessed?: number;
  url?: string;
}

export interface FakeChrome {
  tabs: FakeTab[];
  localStorage: Map<string, unknown>;
  sessionStorage: Map<string, unknown>;
  reloadedTabIds: number[];
}

export function installFakeChrome(): FakeChrome {
  const fake: FakeChrome = {
    tabs: [],
    localStorage: new Map(),
    sessionStorage: new Map(),
    reloadedTabIds: [],
  };

  Object.assign(globalThis, {
    chrome: {
      tabs: {
        query: async () => fake.tabs,
        reload: async (tabId: number) => {
          fake.reloadedTabIds.push(tabId);
        },
      },
      storage: {
        local: storageArea(fake.localStorage),
        session: storageArea(fake.sessionStorage),
      },
    },
  });

  return fake;
}

function storageArea(values: Map<string, unknown>) {
  return {
    get: async (key: string) => ({ [key]: values.get(key) }),
    remove: async (key: string) => values.delete(key),
    set: async (items: Record<string, unknown>) => {
      Object.entries(items).forEach(([key, value]) => values.set(key, value));
    },
  };
}
