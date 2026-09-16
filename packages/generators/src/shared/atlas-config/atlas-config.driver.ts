import type { AtlasGeneratorOptions } from '../types/generator-types.js';
import { aGeneratorOptions } from '../../testkit/generator-options.testkit.js';
import {
  atlasAppConfig,
  atlasBootstrapHtml,
  atlasHostConfig,
} from './atlas-config.js';

export class AtlasConfigDriver {
  private options: AtlasGeneratorOptions = aGeneratorOptions();
  private contents!: string;

  readonly given = {
    options: (options: AtlasGeneratorOptions): this => {
      this.options = options;

      return this;
    },
  };

  readonly when = {
    appConfigGenerated: (): void => {
      this.contents = atlasAppConfig(this.options);
    },
    hostConfigGenerated: (hostId: string): void => {
      this.contents = atlasHostConfig(this.options, hostId);
    },
    bootstrapHtmlGenerated: (): void => {
      this.contents = atlasBootstrapHtml(this.options.name);
    },
  };

  readonly get = {
    contents: (): string => this.contents,
  };
}
