import type {
  AtlasConfig,
  AtlasStylesheet,
  AtlasVersionChannel,
} from '@atlas/schema';
import { TemporaryDirectory } from '../../shared/fs/fs.testkit.js';
import {
  discoverStylesheets,
  extractStylesheetPathsFromIndex,
} from './stylesheets.js';

export class StylesheetsDriver {
  private readonly directory = new TemporaryDirectory();
  private framework: AtlasConfig['framework'] = 'react';
  private channel: AtlasVersionChannel = 'production';

  readonly given = {
    artifactRoot: async (): Promise<this> => {
      await this.directory.create('atlas-stylesheets-');

      return this;
    },
    framework: (framework: AtlasConfig['framework']): this => {
      this.framework = framework;

      return this;
    },
    channel: (channel: AtlasVersionChannel): this => {
      this.channel = channel;

      return this;
    },
    file: async (relativePath: string, contents = ''): Promise<this> => {
      await this.directory.writeFile(relativePath, contents);

      return this;
    },
  };

  readonly get = {
    stylesheets: (baseUrl: string): Promise<AtlasStylesheet[]> =>
      discoverStylesheets({
        artifactRoot: this.directory.root,
        artifactBaseUrl: baseUrl,
        framework: this.framework,
        channel: this.channel,
      }),
    pathsFromIndex: (html: string): string[] =>
      extractStylesheetPathsFromIndex(html),
  };
}
