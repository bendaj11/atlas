import type { AtlasGeneratorOptions } from '../types/generator-types.js';
import { aGeneratorOptions } from '../../testkit/generator-options.testkit.js';
import {
  renderAtlasAppConfig,
  renderAtlasBootstrapHtml,
  renderAtlasHostConfig,
} from './atlas-config.js';

export class AtlasConfigDriver {
  private options = aGeneratorOptions();
  private contents!: string;

  readonly given = {
    options: (options: AtlasGeneratorOptions) => {
      this.options = options;

      return this;
    },
  };

  readonly when = {
    appConfigGenerated: () => {
      this.contents = renderAtlasAppConfig(this.options);
    },
    hostConfigGenerated: (hostId: string) => {
      this.contents = renderAtlasHostConfig({
        generatorOptions: this.options,
        hostId,
      });
    },
    bootstrapHtmlGenerated: () => {
      this.contents = renderAtlasBootstrapHtml(this.options.name);
    },
  };

  readonly get = {
    contents: () => this.contents,
  };
}
