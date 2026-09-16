import {
  createBootstrapHtml,
  validateBootstrapHtml,
  versionLoaderSource,
} from './bootstrap-html.js';
import type { AtlasBootstrapOptions } from './bootstrap-types.js';

export class BootstrapHtmlDriver {
  private options: Pick<AtlasBootstrapOptions, 'title' | 'loadingHtml'> = {};
  private html!: string;
  private error: unknown;

  readonly given = {
    title: (title: string): BootstrapHtmlDriver => {
      this.options = { ...this.options, title };

      return this;
    },
    loadingHtml: (loadingHtml: string): BootstrapHtmlDriver => {
      this.options = { ...this.options, loadingHtml };

      return this;
    },
    html: (html: string): BootstrapHtmlDriver => {
      this.html = html;

      return this;
    },
  };

  readonly when = {
    htmlCreated: (): void => {
      this.html = createBootstrapHtml(this.options);
    },
    loaderSourceVersioned: (): void => {
      this.html = versionLoaderSource(this.html);
    },
    htmlValidated: (): void => {
      try {
        validateBootstrapHtml(this.html);
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    html: (): string => this.html,
    error: (): unknown => this.error,
  };
}
