import { resolveDefaultHostOrigin } from './host-origin.js';

export class HostOriginServerDriver {
  private origin: string | undefined;

  readonly when = {
    originResolved: () => {
      this.origin = resolveDefaultHostOrigin();
    },
  };

  readonly get = {
    origin: () => this.origin,
  };
}
