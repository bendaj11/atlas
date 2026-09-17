import { matchRoutePattern, type RouteParams } from './match-route-pattern.js';

export class MatchRoutePatternDriver {
  private result: RouteParams | undefined;

  readonly when = {
    patternMatched: (pattern: string, pathname: string): void => {
      this.result = matchRoutePattern(pattern, pathname);
    },
  };

  readonly get = {
    result: (): RouteParams | undefined => this.result,
  };
}
