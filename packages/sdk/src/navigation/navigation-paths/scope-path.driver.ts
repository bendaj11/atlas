import { scopePath } from './scope-path.js';

export class ScopePathDriver {
  private path = '/';
  private result: string | undefined;

  readonly given = {
    path: (path: string) => {
      this.path = path;

      return this;
    },
  };

  readonly when = {
    pathScoped: (to: string) => {
      this.result = scopePath(this.path, to);
    },
  };

  readonly get = {
    result: () => this.result,
  };
}
