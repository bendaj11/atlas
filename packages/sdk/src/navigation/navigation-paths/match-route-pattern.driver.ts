import type { AtlasRouteParams } from '../navigation-types/navigation-types.js';
import { matchRoutePattern } from './match-route-pattern.js';

export class MatchRoutePatternDriver {
  private result: AtlasRouteParams | undefined;

  readonly when = {
    patternMatched: (pattern: string, pathname: string) => {
      this.result = matchRoutePattern(pattern, pathname);
    },
  };

  readonly get = {
    result: () => this.result,
  };
}
