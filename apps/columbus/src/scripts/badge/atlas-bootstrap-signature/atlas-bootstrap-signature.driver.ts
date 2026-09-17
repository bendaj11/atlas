export class AtlasBootstrapSignatureDriver {
  private readonly page = document.implementation.createHTMLDocument();

  readonly given = {
    pageBody: (html: string) => {
      this.page.body.innerHTML = html;

      return this;
    },
  };

  readonly get = {
    page: () => this.page,
  };
}
