import { TemporaryDirectory } from '../temporary-directory.testkit.js';
import { loadAtlasRegistryConfig } from '../../src/publication/registry-config/registry-config.js';
import { CliArguments } from '../../src/shared/index.js';

export class RegistryConfigDriver {
  private readonly directory = new TemporaryDirectory();
  private flags: string[] = [];

  readonly given = {
    workingDirectory: async () => {
      await this.directory.create('atlas-registry-config-');
      await this.directory.writeJson('package.json', { type: 'module' });

      return this;
    },
    configFile: async (relativePath: string, source: string) => {
      await this.directory.writeFile(relativePath, source);

      return this;
    },
    flags: (flags: string[]) => {
      this.flags = flags;

      return this;
    },
  };

  readonly get = {
    config: () =>
      loadAtlasRegistryConfig(
        new CliArguments(['publish', 'x', ...this.flags]),
        this.directory.root,
      ),
    leftoverDirectories: async () => {
      const { readdir } = await import('node:fs/promises');

      return (await readdir(this.directory.root)).filter((name) =>
        name.startsWith('.atlas-registry-config-'),
      );
    },
  };
}
