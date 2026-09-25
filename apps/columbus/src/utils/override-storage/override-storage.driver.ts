import {
  type FakeChrome,
  installFakeChrome,
} from '../../testkit/chrome.testkit';

export class OverrideStorageDriver {
  private readonly chrome: FakeChrome = installFakeChrome();

  constructor() {
    localStorage.clear();
    sessionStorage.clear();
  }

  readonly given = {
    extensionStorageItem: (key: string, value: unknown) => {
      this.chrome.localStorage.set(key, value);

      return this;
    },
    pageLocalStorageItem: (key: string, value: string) => {
      localStorage.setItem(key, value);

      return this;
    },
    pageSessionStorageItem: (key: string, value: string) => {
      sessionStorage.setItem(key, value);

      return this;
    },
  };

  readonly get = {
    extensionStorageItem: (key: string) => this.chrome.localStorage.get(key),
    pageLocalStorageItem: (key: string) => parse(localStorage.getItem(key)),
    pageSessionStorageItem: (key: string) => parse(sessionStorage.getItem(key)),
  };
}

function parse(value: string | null): unknown {
  return value === null ? undefined : JSON.parse(value);
}
