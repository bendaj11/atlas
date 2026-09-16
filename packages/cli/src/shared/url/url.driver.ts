import {
  isLoopbackUrl,
  isSecureOrLoopbackUrl,
  trimTrailingSlash,
} from './url.js';

export class UrlDriver {
  private value = '';

  readonly given = {
    value: (value: string): this => {
      this.value = value;

      return this;
    },
  };

  readonly get = {
    loopback: (): boolean => isLoopbackUrl(new URL(this.value)),
    secureOrLoopback: (): boolean => isSecureOrLoopbackUrl(new URL(this.value)),
    trimmed: (): string => trimTrailingSlash(this.value),
  };
}
