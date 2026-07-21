export {};

declare global {
  namespace chrome {
    namespace tabs {
      interface Tab { active?: boolean; id?: number; lastAccessed?: number; url?: string }
      interface TabChangeInfo { status?: "loading" | "complete"; url?: string }
      function query(queryInfo: { active?: boolean; currentWindow?: boolean }): Promise<Tab[]>;
      function reload(tabId: number): Promise<void>;
      namespace onUpdated {
        function addListener(listener: (tabId: number, changeInfo: TabChangeInfo, tab: Tab) => void): void;
      }
      namespace onRemoved {
        function addListener(listener: (tabId: number) => void): void;
      }
    }
    namespace scripting {
      interface InjectionResult<T> { result?: T }
      function executeScript<T>(options: { target: { tabId: number }; world?: "MAIN"; func: (...args: any[]) => T | Promise<T>; args?: unknown[] }): Promise<Array<InjectionResult<Awaited<T>>>>;
    }
    namespace storage.local {
      function get(key: string): Promise<Record<string, unknown>>;
      function remove(key: string): Promise<void>;
      function set(items: Record<string, unknown>): Promise<void>;
    }
    namespace storage.session {
      function get(key: string): Promise<Record<string, unknown>>;
      function remove(key: string): Promise<void>;
      function set(items: Record<string, unknown>): Promise<void>;
    }
    namespace action {
      function setBadgeBackgroundColor(details: { color: string }): Promise<void>;
      const setBadgeTextColor: undefined | ((details: { color: string }) => Promise<void>);
      function setBadgeText(details: { text: string; tabId?: number }): Promise<void>;
    }
    namespace runtime.onInstalled {
      function addListener(listener: () => void): void;
    }
    namespace runtime {
      function sendMessage(message: unknown): Promise<unknown>;
    }
    namespace runtime.onMessage {
      function addListener(listener: (message: unknown, sender: { tab?: tabs.Tab }) => void): void;
    }
  }
}
