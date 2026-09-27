export class DevelopmentSessionSourceDriver {
  constructor() {
    sessionStorage.clear();
    localStorage.clear();
  }

  readonly given = {
    sessionStorageItem: (key: string, value: string) => {
      sessionStorage.setItem(key, value);

      return this;
    },
    localStorageItem: (key: string, value: string) => {
      localStorage.setItem(key, value);

      return this;
    },
  };

  readonly get = {
    dependencies: () => ({
      sessionStorage,
      localStorage,
    }),
  };
}
