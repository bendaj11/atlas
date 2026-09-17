import { normalizePath, convertHostPathToInnerPath } from './path-conversions.js';

export class PathConversionsDriver {
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
      this.result = convertHostPathToInnerPath(this.path, pathname);
    },
  };

  readonly get = {
    result: (): string | undefined => this.result,
  };
}
