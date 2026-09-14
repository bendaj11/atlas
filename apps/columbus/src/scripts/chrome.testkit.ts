import type {} from '../types/chrome';

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
  tabMessages: Array<{ tabId: number; message: unknown }>;
  onTabMessage: (tabId: number, message: unknown) => Promise<unknown>;
}

export function installFakeChrome(): FakeChrome {
  const fake: FakeChrome = {
    tabs: [],
    localStorage: new Map(),
    sessionStorage: new Map(),
    reloadedTabIds: [],
    tabMessages: [],
    onTabMessage: async () => undefined,
  };

  Object.assign(globalThis, {
    chrome: {
      tabs: {
        query: async () => fake.tabs,
        reload: async (tabId: number) => {
          fake.reloadedTabIds.push(tabId);
        },
        sendMessage: (tabId: number, message: unknown) => {
          fake.tabMessages.push({ tabId, message });

          return fake.onTabMessage(tabId, message);
        },
      },
      scripting: {
        executeScript: async ({
          func,
          args,
        }: {
          func: (...values: string[]) => void;
          args: string[];
        }) => {
          func(...args);

          return [{ result: undefined }];
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
