import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readAtlasPreviewUrls } from './previews.js';

export class AtlasPreviewUrlsDriver {
  private projectRoot = '';
  private result?: readonly string[];
  private error?: Error;

  given = {
    packageJson: async (value: unknown): Promise<void> => {
      this.projectRoot = await mkdtemp(join(tmpdir(), 'atlas-previews-'));
      await writeFile(
        join(this.projectRoot, 'package.json'),
        JSON.stringify(value),
      );
    },
  };

  when = {
    read: async (): Promise<void> => {
      try {
        this.result = await readAtlasPreviewUrls(this.projectRoot);
      } catch (error) {
        this.error = error as Error;
      }
    },
  };

  get = {
    result: (): readonly string[] | undefined => this.result,
    errorMessage: (): string | undefined => this.error?.message,
  };
}
