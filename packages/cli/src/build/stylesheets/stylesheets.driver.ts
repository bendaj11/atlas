import type { AtlasConfig, AtlasVersionChannel } from '@atlas/schema';
import {
  InMemoryDirectory,
  mockFileSystem,
  resetFileSystem,
} from '../../shared/fs/in-memory-fs.testkit.js';

mockFileSystem();

const { discoverStylesheets, extractStylesheetPathsFromIndex } =
  await import('./stylesheets.js');

export class StylesheetsDriver {
  private readonly directory = new InMemoryDirectory();
  private framework: AtlasConfig['framework'] = 'react';
  private channel: AtlasVersionChannel = 'production';

  constructor() {
    resetFileSystem();
  }

  readonly given = {
    artifactRoot: async () => {
      await this.directory.create('atlas-stylesheets-');

      return this;
    },
    framework: (framework: AtlasConfig['framework']) => {
      this.framework = framework;

      return this;
    },
    channel: (channel: AtlasVersionChannel) => {
      this.channel = channel;

      return this;
    },
    file: async (relativePath: string, contents = '') => {
      await this.directory.writeFile(relativePath, contents);

      return this;
    },
  };

  readonly get = {
    stylesheets: (baseUrl: string) =>
      discoverStylesheets({
        artifactRoot: this.directory.root,
        artifactBaseUrl: baseUrl,
        framework: this.framework,
        channel: this.channel,
      }),
    pathsFromIndex: (html: string) => extractStylesheetPathsFromIndex(html),
  };
}
