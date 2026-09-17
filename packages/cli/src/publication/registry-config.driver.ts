import { TemporaryDirectory } from '../shared/fs/fs.testkit.js';
import {
  loadAtlasRegistryConfig,
  type AtlasRegistryConfig,
} from './registry-config.js';
import { CliArguments } from '../shared/index.js';

export class RegistryConfigDriver {
  private readonly directory = new TemporaryDirectory();
  private flags: string[] = [];

  readonly given = {
    workingDirectory: async (): Promise<this> => {
      await this.directory.create('atlas-registry-config-');
      await this.directory.writeJson('package.json', { type: 'module' });

      return this;
    },
    configFile: async (relativePath: string, source: string): Promise<this> => {
      await this.directory.writeFile(relativePath, source);

      return this;
    },
    flags: (flags: string[]): this => {
      this.flags = flags;

      return this;
    },
  };

  readonly get = {
    config: (): Promise<AtlasRegistryConfig | undefined> =>
      loadAtlasRegistryConfig(
        new CliArguments(['publish', 'x', ...this.flags]),
        this.directory.root,
      ),
    leftoverDirectories: async (): Promise<string[]> => {
      const { readdir } = await import('node:fs/promises');

      return (await readdir(this.directory.root)).filter((name) =>
        name.startsWith('.atlas-registry-config-'),
      );
    },
  };
}
