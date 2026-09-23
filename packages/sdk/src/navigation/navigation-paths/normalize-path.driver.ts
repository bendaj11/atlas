import { normalizePath, toInnerPath } from './normalize-path.js';

export class NormalizePathDriver {
  private path = '/';
  private result: string | undefined;

  readonly given = {
    path: (path: string) => {
      this.path = path;

      return this;
    },
  };

  readonly when = {
    pathNormalized: () => {
      this.result = normalizePath(this.path);
    },
    innerPathRead: (pathname: string) => {
      this.result = toInnerPath(this.path, pathname);
    },
  };

  readonly get = {
    result: () => this.result,
  };
}
