import { hasAtlasBootstrapSignature } from './atlas-bootstrap-signature.js';

export class AtlasBootstrapSignatureDriver {
  private page = document.implementation.createHTMLDocument();

  readonly given = {
    atlasBootstrapPage: (): this => {
      this.page.body.innerHTML =
        '<div id="atlas-host-root"></div><script type="module" src="/atlas.loader.js?v=build"></script>';
      return this;
    },
    loaderScriptOnly: (): this => {
      this.page.body.innerHTML = '<script src="/atlas.loader.js"></script>';
      return this;
    },
    hostRootOnly: (): this => {
      this.page.body.innerHTML = '<div id="atlas-host-root"></div>';
      return this;
    },
  };

  readonly get = {
    isAtlasBootstrapPage: (): boolean => hasAtlasBootstrapSignature(this.page),
  };
}
