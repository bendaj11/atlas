import { TemporaryDirectory } from '../temporary-directory.testkit.js';
import { loadCompiledAtlasConfig } from '../../src/build/config-loader/config-loader.js';

export class ConfigLoaderDriver {
  private readonly directory = new TemporaryDirectory();

  readonly given = {
    projectRoot: async () => {
      await this.directory.create('atlas-config-loader-');
      await this.directory.writeJson('package.json', { type: 'module' });

      return this;
    },
    compiledConfig: async (relativePath: string, source: string) => {
      await this.directory.writeFile(relativePath, source);

      return this;
    },
  };

  readonly get = {
    config: () => loadCompiledAtlasConfig(this.directory.root),
  };
}
