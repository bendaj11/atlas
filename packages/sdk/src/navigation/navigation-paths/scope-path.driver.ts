import { scopePath } from './scope-path.js';

export class ScopePathDriver {
  private path = '/';
  private result: string | undefined;

  readonly given = {
    path: (path: string): this => {
      this.path = path;

      return this;
    },
  };

  readonly when = {
    pathScoped: (to: string): void => {
      this.result = scopePath(this.path, to);
    },
  };

  readonly get = {
    result: (): string | undefined => this.result,
  };
}
