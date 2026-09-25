import type {} from '../types/chrome';

export interface FakeTab {
  active?: boolean;
  id?: number;
  lastAccessed?: number;
  url?: string;
  windowId?: number;
}

export interface MessageSender {
  tab?: FakeTab;
  url?: string;
}

type RuntimeMessageListener = (
  message: unknown,
  sender: MessageSender,
  sendResponse: (response: unknown) => void,
) => void | boolean;

export interface FakeChrome {
  tabs: FakeTab[];
  localStorage: Map<string, unknown>;
  sessionStorage: Map<string, unknown>;
  reloadedTabIds: number[];
  activatedTabIds: number[];
  removedTabIds: number[];
  focusedWindowIds: number[];
  tabMessages: Array<{ tabId: number; message: unknown }>;
  runtimeMessages: unknown[];
  badgeTexts: Array<{ tabId?: number; text: string }>;
  badgeBackgroundColors: string[];
  badgeTextColors: string[];
  actionIconPaths: Array<Record<string, string>>;
  onTabMessage: (tabId: number, message: unknown) => Promise<unknown>;
  onRuntimeMessage: (message: unknown) => Promise<unknown>;
  emitTabUpdated: (
    tabId: number,
    changeInfo: chrome.tabs.TabChangeInfo,
  ) => void;
  emitTabRemoved: (tabId: number) => void;
  emitRuntimeMessage: (
    message: unknown,
    sender?: MessageSender,
  ) => Promise<unknown>;
}

export function installFakeChrome(): FakeChrome {
  const tabUpdatedListeners: Array<
    (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: FakeTab) => void
  > = [];
  const tabRemovedListeners: Array<(tabId: number) => void> = [];
  const runtimeMessageListeners: RuntimeMessageListener[] = [];
  const fake: FakeChrome = {
    tabs: [],
    localStorage: new Map(),
    sessionStorage: new Map(),
    reloadedTabIds: [],
    activatedTabIds: [],
    removedTabIds: [],
    focusedWindowIds: [],
    tabMessages: [],
    runtimeMessages: [],
    badgeTexts: [],
    badgeBackgroundColors: [],
    badgeTextColors: [],
    actionIconPaths: [],
    onTabMessage: async () => undefined,
    onRuntimeMessage: async () => undefined,
    emitTabUpdated: (tabId, changeInfo) => {
      tabUpdatedListeners.forEach((listener) =>
        listener(tabId, changeInfo, { id: tabId }),
      );
    },
    emitTabRemoved: (tabId) => {
      tabRemovedListeners.forEach((listener) => listener(tabId));
    },
    emitRuntimeMessage: (message, sender = {}) =>
      new Promise((resolve) => {
        const keepsChannelOpen = runtimeMessageListeners.some(
          (listener) => listener(message, sender, resolve) === true,
        );
        if (!keepsChannelOpen) resolve(undefined);
      }),
  };

  Object.assign(globalThis, {
    chrome: {
      tabs: {
        query: async () => fake.tabs,
        reload: async (tabId: number) => {
          fake.reloadedTabIds.push(tabId);
        },
        remove: async (tabId: number) => {
          fake.removedTabIds.push(tabId);
        },
        update: async (tabId: number, properties: { active?: boolean }) => {
          if (properties.active) fake.activatedTabIds.push(tabId);

          return { id: tabId };
        },
        sendMessage: (tabId: number, message: unknown) => {
          fake.tabMessages.push({ tabId, message });

          return fake.onTabMessage(tabId, message);
        },
        onUpdated: {
          addListener: (listener: (typeof tabUpdatedListeners)[number]) => {
            tabUpdatedListeners.push(listener);
          },
        },
        onRemoved: {
          addListener: (listener: (tabId: number) => void) => {
            tabRemovedListeners.push(listener);
          },
        },
      },
      windows: {
        update: async (windowId: number) => {
          fake.focusedWindowIds.push(windowId);
        },
      },
      runtime: {
        sendMessage: (message: unknown) => {
          fake.runtimeMessages.push(message);

          return fake.onRuntimeMessage(message);
        },
        onMessage: {
          addListener: (listener: RuntimeMessageListener) => {
            runtimeMessageListeners.push(listener);
          },
        },
      },
      action: {
        setIcon: async ({ path }: { path: Record<string, string> }) => {
          fake.actionIconPaths.push(path);
        },
        setBadgeBackgroundColor: async ({ color }: { color: string }) => {
          fake.badgeBackgroundColors.push(color);
        },
        setBadgeTextColor: async ({ color }: { color: string }) => {
          fake.badgeTextColors.push(color);
        },
        setBadgeText: async (details: { tabId?: number; text: string }) => {
          fake.badgeTexts.push(details);
        },
      },
      scripting: {
        executeScript: async <Args extends unknown[]>({
          func,
          args,
        }: {
          func: (...values: Args) => void;
          args: Args;
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
