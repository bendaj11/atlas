import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { readAtlasPreviewUrls } from './previews.js';
import { TemporaryDirectory } from '../../shared/fs/fs.testkit.js';

export class AtlasPreviewUrlsDriver {
  private readonly temporaryDirectory = new TemporaryDirectory();
  private projectRoot = '';
  private result?: readonly string[];
  private error?: Error;

  given = {
    packageJson: async (value: unknown) => {
      this.projectRoot =
        await this.temporaryDirectory.create('atlas-previews-');
      await writeFile(
        join(this.projectRoot, 'package.json'),
        JSON.stringify(value),
      );
    },
  };

  when = {
    read: async () => {
      try {
        this.result = await readAtlasPreviewUrls(this.projectRoot);
      } catch (error) {
        this.error = error as Error;
      }
    },
  };

  get = {
    result: () => this.result,
    extractErrorMessage: () => this.error?.message,
  };
}
