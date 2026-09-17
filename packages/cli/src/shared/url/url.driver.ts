import {
  isLoopbackUrl,
  isSecureOrLoopbackUrl,
  normalizeRoutePath,
  trimTrailingSlash,
} from './url.js';

export class UrlDriver {
  private value = '';

  readonly given = {
    value: (value: string) => {
      this.value = value;

      return this;
    },
  };

  readonly get = {
    loopback: () => isLoopbackUrl(new URL(this.value)),
    secureOrLoopback: () => isSecureOrLoopbackUrl(new URL(this.value)),
    trimmed: () => trimTrailingSlash(this.value),
    routePath: () => normalizeRoutePath(this.value),
  };
}
