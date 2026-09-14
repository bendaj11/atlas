import {
  isExtensionPageUrl,
  isLoopbackHostname,
  isLoopbackUrl,
  isWebPageUrl,
} from './urls';

export class UrlsDriver {
  private result: boolean | undefined;

  readonly when = {
    loopbackHostnameChecked: (hostname: string): this => {
      this.result = isLoopbackHostname(hostname);

      return this;
    },
    loopbackUrlChecked: (url: string | undefined): this => {
      this.result = isLoopbackUrl(url);

      return this;
    },
    webPageUrlChecked: (url: string | undefined): this => {
      this.result = isWebPageUrl(url);

      return this;
    },
    extensionPageUrlChecked: (url: string | undefined): this => {
      this.result = isExtensionPageUrl(url);

      return this;
    },
  };

  readonly get = {
    result: (): boolean | undefined => this.result,
  };
}
