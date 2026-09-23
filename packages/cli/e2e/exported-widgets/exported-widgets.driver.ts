import { faker } from '@faker-js/faker';
import type { AtlasConfig } from '@atlas/schema';
import { TemporaryDirectory } from '../temporary-directory.testkit.js';
import { discoverExportedWidgets } from '../../src/build/exported-widgets/exported-widgets.js';

export class ExportedWidgetsDriver {
  private readonly directory = new TemporaryDirectory();
  private config: AtlasConfig = {
    id: faker.string.uuid(),
    framework: 'react',
  } as AtlasConfig;

  readonly given = {
    projectRoot: async () => {
      await this.directory.create('atlas-exported-widgets-');

      return this;
    },
    framework: (framework: AtlasConfig['framework']) => {
      this.config = { ...this.config, framework };

      return this;
    },
    widgetFile: async (widget: string, file: string, contents = '') => {
      await this.directory.writeFile(
        `src/exported-widgets/${widget}/${file}`,
        contents,
      );

      return this;
    },
  };

  readonly get = {
    configId: () => this.config.id,
    widgets: (ownerRemoteEntryUrl: string) =>
      discoverExportedWidgets({
        projectRoot: this.directory.root,
        config: this.config,
        ownerRemoteEntryUrl,
      }),
  };
}
