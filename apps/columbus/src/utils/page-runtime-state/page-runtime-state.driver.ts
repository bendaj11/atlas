export class PageRuntimeStateDriver {
  constructor() {
    localStorage.clear();
    sessionStorage.clear();
    document.body.innerHTML = '';
  }

  readonly given = {
    pageLocalStorage: (key: string, value: string) => {
      localStorage.setItem(key, value);

      return this;
    },
    pageSessionStorage: (key: string, value: string) => {
      sessionStorage.setItem(key, value);

      return this;
    },
    pageBody: (html: string) => {
      document.body.innerHTML = html;

      return this;
    },
  };
}
