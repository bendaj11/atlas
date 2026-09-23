import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { faker } from '@faker-js/faker';
import {
  mockFileSystem,
  resetFileSystem,
} from '../../shared/fs/in-memory-fs.testkit.js';

mockFileSystem();

const { mkdtemp, writeFile } = await import('node:fs/promises');
const { loadEnvFiles } = await import('./env.js');

export class WorkspaceEnvDriver {
  private readonly registryUrl = faker.internet.url();
  private readonly fileRegistryUrl = faker.internet.url();
  private readonly originalRegistryUrl = process.env.ATLAS_REGISTRY_URL;
  private root = '';
  private loadedValues?: Record<string, string | undefined>;

  constructor() {
    resetFileSystem();
  }

  given = {
    layeredFiles: async () => {
      this.root = await mkdtemp(join(tmpdir(), 'atlas-env-'));
      process.env.ATLAS_REGISTRY_URL = this.registryUrl;

      await writeFile(
        join(this.root, '.env'),
        `ATLAS_REGISTRY_URL=${this.fileRegistryUrl}\n`,
      );
      await writeFile(
        join(this.root, '.env.local'),
        `ATLAS_REGISTRY_URL=${this.fileRegistryUrl}\n`,
      );
    },
  };

  when = {
    load: async () => {
      try {
        await loadEnvFiles(this.root);
        this.loadedValues = {
          registryUrl: process.env.ATLAS_REGISTRY_URL,
        };
      } finally {
        this.restoreEnvironment();
      }
    },
  };

  get = {
    loadedValues: () => this.loadedValues ?? {},
    layeredValues: () => ({
      registryUrl: this.registryUrl,
    }),
  };

  private restoreEnvironment(): void {
    this.restore('ATLAS_REGISTRY_URL', this.originalRegistryUrl);
  }

  private restore(name: string, value: string | undefined): void {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
}
