import { resolveDefaultHostOrigin } from './host-origin.js';

export class HostOriginDriver {
  private origin: string | undefined;

  readonly when = {
    originResolved: (): void => {
      this.origin = resolveDefaultHostOrigin();
    },
  };

  readonly get = {
    origin: (): string | undefined => this.origin,
    windowOrigin: (): string =>
      typeof window === 'undefined' ? '' : window.location.origin,
  };
}
