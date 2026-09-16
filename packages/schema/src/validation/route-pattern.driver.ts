import { isRoutePattern, normalizeRoutePath } from './route-pattern.js';

export class RoutePatternDriver {
  private valid = false;
  private normalized = '';

  when = {
    checked: (value: string): void => {
      this.valid = isRoutePattern(value);
    },
    normalized: (value: string): void => {
      this.normalized = normalizeRoutePath(value);
    },
  };

  get = {
    valid: (): boolean => this.valid,
    normalized: (): string => this.normalized,
  };
}
