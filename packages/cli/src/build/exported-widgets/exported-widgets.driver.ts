import { faker } from '@faker-js/faker';
import type { AtlasConfig, AtlasExportedWidgetManifest } from '@atlas/schema';
import { TemporaryDirectory } from '../../shared/fs/fs.testkit.js';
import { discoverExportedWidgets } from './exported-widgets.js';

export class ExportedWidgetsDriver {
  private readonly directory = new TemporaryDirectory();
  private config: AtlasConfig = {
    id: faker.string.uuid(),
    framework: 'react',
  } as AtlasConfig;

  readonly given = {
    projectRoot: async (): Promise<this> => {
      await this.directory.create('atlas-exported-widgets-');

      return this;
    },
    framework: (framework: AtlasConfig['framework']): this => {
      this.config = { ...this.config, framework };

      return this;
    },
    widgetFile: async (
      widget: string,
      file: string,
      contents = '',
    ): Promise<this> => {
      await this.directory.writeFile(
        `src/exported-widgets/${widget}/${file}`,
        contents,
      );

      return this;
    },
  };

  readonly get = {
    configId: (): string => this.config.id,
    widgets: (
      ownerRemoteEntryUrl: string,
    ): Promise<AtlasExportedWidgetManifest[]> =>
      discoverExportedWidgets({
        projectRoot: this.directory.root,
        config: this.config,
        ownerRemoteEntryUrl,
      }),
  };
}
