import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { faker } from '@faker-js/faker';
import { loadEnvFiles, saveWorkspaceLocalEnv } from './env.js';

export class WorkspaceEnvDriver {
  private readonly registryUrl = faker.internet.url();
  private readonly fileRegistryUrl = faker.internet.url();
  private readonly hostUrl = faker.internet.url();
  private readonly localHostUrl = faker.internet.url();
  private readonly originalRegistryUrl = process.env.ATLAS_REGISTRY_URL;
  private readonly originalHostUrl = process.env.ATLAS_HOST_URL;
  private root = '';
  private loadedValues?: Record<string, string | undefined>;

  given = {
    layeredFiles: async (): Promise<void> => {
      this.root = await mkdtemp(join(tmpdir(), 'atlas-env-'));
      process.env.ATLAS_REGISTRY_URL = this.registryUrl;
      delete process.env.ATLAS_HOST_URL;

      await writeFile(
        join(this.root, '.env'),
        `ATLAS_REGISTRY_URL=${this.fileRegistryUrl}\nATLAS_HOST_URL=${this.hostUrl}\n`,
      );
      await writeFile(
        join(this.root, '.env.local'),
        `ATLAS_HOST_URL=${this.localHostUrl}\n`,
      );
    },

    existingLocalFile: async (): Promise<void> => {
      this.root = await mkdtemp(join(tmpdir(), 'atlas-env-save-'));

      await writeFile(
        join(this.root, '.env.local'),
        `UNCHANGED=${faker.word.noun()}\nATLAS_HOST_URL=${this.hostUrl}\n`,
      );
    },
  };

  when = {
    load: async (): Promise<void> => {
      try {
        await loadEnvFiles(this.root);
        this.loadedValues = {
          registryUrl: process.env.ATLAS_REGISTRY_URL,
          hostUrl: process.env.ATLAS_HOST_URL,
        };
      } finally {
        this.restoreEnvironment();
      }
    },

    saveHostUrl: async (): Promise<void> => {
      await saveWorkspaceLocalEnv(this.root, {
        ATLAS_HOST_URL: this.localHostUrl,
      });
    },
  };

  get = {
    loadedValues: (): Record<string, string | undefined> =>
      this.loadedValues ?? {},
    layeredValues: (): Record<string, string> => ({
      registryUrl: this.registryUrl,
      hostUrl: this.localHostUrl,
    }),
    savedFile: async (): Promise<string> =>
      await readFile(join(this.root, '.env.local'), 'utf8'),
    savedHostEntry: (): string => `ATLAS_HOST_URL=${this.localHostUrl}`,
  };

  private restoreEnvironment(): void {
    this.restore('ATLAS_REGISTRY_URL', this.originalRegistryUrl);
    this.restore('ATLAS_HOST_URL', this.originalHostUrl);
  }

  private restore(name: string, value: string | undefined): void {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
}
