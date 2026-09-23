import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  mockFileSystem,
  resetFileSystem,
} from '../../shared/fs/in-memory-fs.testkit.js';

mockFileSystem();

const { mkdtemp, writeFile } = await import('node:fs/promises');
const { readAtlasPreviewUrls } = await import('./previews.js');

export class AtlasPreviewUrlsDriver {
  private projectRoot = '';
  private result?: readonly string[];
  private error?: Error;

  constructor() {
    resetFileSystem();
  }

  given = {
    packageJson: async (value: unknown) => {
      this.projectRoot = await mkdtemp(join(tmpdir(), 'atlas-previews-'));
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
