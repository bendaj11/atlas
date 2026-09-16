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
    signatureChecked: (): void => {
      this.result = hasAtlasBootstrapSignature(this.page);
    },
  };

  readonly get = {
    hasSignature: (): boolean | undefined => this.result,
  };
}
