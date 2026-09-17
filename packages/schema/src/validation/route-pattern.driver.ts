import { isRoutePattern, normalizeRoutePath } from './route-pattern.js';

export class RoutePatternDriver {
  private valid = false;
  private normalized = '';

  when = {
    checked: (value: string) => {
      this.valid = isRoutePattern(value);
    },
    normalized: (value: string) => {
      this.normalized = normalizeRoutePath(value);
    },
  };

  get = {
    valid: () => this.valid,
    normalized: () => this.normalized,
  };
}
