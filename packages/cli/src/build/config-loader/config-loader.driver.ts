import type { AtlasConfig } from '@atlas/schema';
import { TemporaryDirectory } from '../../shared/fs/fs.testkit.js';
import { loadCompiledAtlasConfig } from './config-loader.js';

export class ConfigLoaderDriver {
  private readonly directory = new TemporaryDirectory();

  readonly given = {
    projectRoot: async (): Promise<this> => {
      await this.directory.create('atlas-config-loader-');
      await this.directory.writeJson('package.json', { type: 'module' });

      return this;
    },
    compiledConfig: async (
      relativePath: string,
      source: string,
    ): Promise<this> => {
      await this.directory.writeFile(relativePath, source);

      return this;
    },
  };

  readonly get = {
    config: (): Promise<AtlasConfig> =>
      loadCompiledAtlasConfig(this.directory.root),
  };
}
