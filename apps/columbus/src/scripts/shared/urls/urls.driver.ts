import {
  isExtensionPageUrl,
  isLoopbackHostname,
  isLoopbackUrl,
  isWebPageUrl,
} from './urls';

export class UrlsDriver {
  private result: boolean | undefined;

  readonly when = {
    loopbackHostnameChecked: (hostname: string): void => {
      this.result = isLoopbackHostname(hostname);
    },
    loopbackUrlChecked: (url: string | undefined): void => {
      this.result = isLoopbackUrl(url);
    },
    webPageUrlChecked: (url: string | undefined): void => {
      this.result = isWebPageUrl(url);
    },
    extensionPageUrlChecked: (url: string | undefined): void => {
      this.result = isExtensionPageUrl(url);
    },
  };

  readonly get = {
    result: (): boolean | undefined => this.result,
  };
}
