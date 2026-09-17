import { normalizePath, toInnerPath } from './normalize-path.js';

export class NormalizePathDriver {
  private path = '/';
  private result: string | undefined;

  readonly given = {
    path: (path: string): this => {
      this.path = path;

      return this;
    },
  };

  readonly when = {
    pathNormalized: (): void => {
      this.result = normalizePath(this.path);
    },
    innerPathRead: (pathname: string): void => {
      this.result = toInnerPath(this.path, pathname);
    },
  };

  readonly get = {
    result: (): string | undefined => this.result,
  };
}
