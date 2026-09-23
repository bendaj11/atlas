export class ControlPortDriver {
  constructor() {
    sessionStorage.clear();
  }

  readonly given = {
    sessionStorageItem: (key: string, value: string) => {
      sessionStorage.setItem(key, value);

      return this;
    },
  };

  readonly get = {
    sessionStorageItem: (key: string) => sessionStorage.getItem(key),
  };
}
