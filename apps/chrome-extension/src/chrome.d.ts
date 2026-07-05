declare namespace chrome {
  namespace tabs {
    interface Tab { id?: number; url?: string }
    function query(queryInfo: { active: boolean; currentWindow: boolean }): Promise<Tab[]>;
    function reload(tabId: number): Promise<void>;
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
  namespace runtime.onInstalled {
    function addListener(listener: () => void): void;
  }
}
