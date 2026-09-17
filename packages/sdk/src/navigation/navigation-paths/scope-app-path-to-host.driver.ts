import { scopeAppPathToHost } from './scope-app-path-to-host.js';

export class ScopeAppPathToHostDriver {
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
      this.result = scopeAppPathToHost(this.path, to);
    },
  };

  readonly get = {
    result: (): string | undefined => this.result,
  };
}
