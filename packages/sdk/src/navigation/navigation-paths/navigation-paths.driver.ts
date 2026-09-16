import { jest } from '@jest/globals';
import type { AtlasNavigation } from '../navigation-types/navigation-types.js';
import {
  goThroughHistory,
  matchRoutePattern,
  normalizePath,
  parseQuery,
  scopePath,
  toInnerPath,
} from './navigation-paths.js';

export class NavigationPathsDriver {
  private readonly back = jest.fn<AtlasNavigation['back']>();
  private readonly go = jest.fn<NonNullable<AtlasNavigation['go']>>();
  private path = '/';
  private result: unknown;

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
    pathNormalized: (): void => {
      this.result = normalizePath(this.path);
    },
    innerPathRead: (pathname: string): void => {
      this.result = toInnerPath(this.path, pathname);
    },
    queryParsed: (search: string): void => {
      this.result = parseQuery(search);
    },
    patternMatched: (pattern: string, pathname: string): void => {
      this.result = matchRoutePattern(pattern, pathname);
    },
    historyMovedWithGo: (delta: number): void => {
      goThroughHistory({ back: this.back, go: this.go }, delta);
    },
    historyMovedWithoutGo: (delta: number): void => {
      goThroughHistory({ back: this.back }, delta);
    },
  };

  readonly get = {
    result: (): unknown => this.result,
    backMock: (): jest.Mock<AtlasNavigation['back']> => this.back,
    goMock: (): jest.Mock<NonNullable<AtlasNavigation['go']>> => this.go,
  };
}
