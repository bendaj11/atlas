import {
  createBootstrapHtml,
  validateBootstrapHtml,
  applyVersionedLoaderSource,
} from './bootstrap-html.js';
import type { AtlasBootstrapOptions } from '../bootstrap-types.js';

export class BootstrapHtmlDriver {
  private options: Pick<AtlasBootstrapOptions, 'title' | 'loadingHtml'> = {};
  private html!: string;
  private error: unknown;

  readonly given = {
    title: (title: string) => {
      this.options = { ...this.options, title };

      return this;
    },
    loadingHtml: (loadingHtml: string) => {
      this.options = { ...this.options, loadingHtml };

      return this;
    },
    html: (html: string) => {
      this.html = html;

      return this;
    },
  };

  readonly when = {
    htmlCreated: () => {
      this.html = createBootstrapHtml(this.options);
    },
    loaderSourceVersioned: () => {
      this.html = applyVersionedLoaderSource(this.html);
    },
    htmlValidated: () => {
      try {
        validateBootstrapHtml(this.html);
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    html: () => this.html,
    error: () => this.error,
  };
}
