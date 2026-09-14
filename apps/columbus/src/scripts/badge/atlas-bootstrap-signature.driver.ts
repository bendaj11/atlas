import { hasAtlasBootstrapSignature } from './atlas-bootstrap-signature';

export class AtlasBootstrapSignatureDriver {
  private readonly page = document.implementation.createHTMLDocument();
  private result: boolean | undefined;

  readonly given = {
    pageBody: (html: string): this => {
      this.page.body.innerHTML = html;

      return this;
    },
  };

  readonly when = {
    signatureChecked: (): this => {
      this.result = hasAtlasBootstrapSignature(this.page);

      return this;
    },
  };

  readonly get = {
    hasSignature: (): boolean | undefined => this.result,
  };
}
