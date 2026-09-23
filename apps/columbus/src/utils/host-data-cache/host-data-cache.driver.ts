import {
  type FakeChrome,
  type FakeTab,
  installFakeChrome,
} from '../../testkit/chrome.testkit';

export class HostDataCacheDriver {
  private readonly chrome: FakeChrome = installFakeChrome();

  readonly given = {
    tabs: (tabs: FakeTab[]) => {
      this.chrome.tabs = tabs;

      return this;
    },
    sessionStorageItem: (key: string, value: unknown) => {
      this.chrome.sessionStorage.set(key, value);

      return this;
    },
  };

  readonly get = {
    sessionStorageItem: (key: string) => this.chrome.sessionStorage.get(key),
  };
}
