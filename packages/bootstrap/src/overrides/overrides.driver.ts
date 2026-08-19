import type { AtlasHostCatalog } from '@atlas/schema';
import { faker } from '../test-utils/faker.js';
import { applyOverrides } from './overrides.js';

export class OverridesDriver {
  private readonly storage = new Map<string, string>();
  private readonly schemaVersion = faker.custom.schemaVersion();
  private readonly channel = faker.custom.channel();
  private readonly framework = faker.custom.framework();
  private readonly hostId = faker.string.uuid();
  private readonly hostName = faker.company.name();
  private readonly remoteEntryUrl = faker.internet.url();
  private result: AtlasHostCatalog | undefined;
  private error: unknown;

  readonly given = {
    noStoredOverride: (_stored: undefined): OverridesDriver => {
      this.storage.clear();
      Object.assign(globalThis, {
        location: { search: '' },
        localStorage: {
          getItem: (key: string) => this.storage.get(key) ?? null,
        },
        sessionStorage: {
          getItem: (key: string) => this.storage.get(key) ?? null,
        },
      });
      return this;
    },
    overrideForAnotherHost: (hostId: string): OverridesDriver => {
      this.storage.clear();
      this.storage.set('atlas.runtime-overrides', JSON.stringify({ hostId }));
      Object.assign(globalThis, {
        localStorage: {
          getItem: (key: string) => this.storage.get(key) ?? null,
        },
        sessionStorage: {
          getItem: (key: string) => this.storage.get(key) ?? null,
        },
      });
      return this;
    },
    invalidAppOverride: (override: object): OverridesDriver => {
      this.storage.clear();
      this.storage.set('atlas.runtime-overrides', JSON.stringify(override));
      Object.assign(globalThis, {
        localStorage: {
          getItem: (key: string) => this.storage.get(key) ?? null,
        },
        sessionStorage: {
          getItem: (key: string) => this.storage.get(key) ?? null,
        },
      });
      return this;
    },
  };

  readonly when = {
    apply: async (): Promise<void> => {
      try {
        this.result = await applyOverrides(
          {
            schemaVersion: this.schemaVersion,
            hostId: this.hostId,
            catalogUrl: faker.internet.url(),
          },
          {
            schemaVersion: this.schemaVersion,
            hostId: this.hostId,
            revision: 'sha256:' + faker.string.alphanumeric(32),
            generatedAt: faker.date.past().toISOString(),
            host: {
              schemaVersion: this.schemaVersion,
              kind: 'host',
              id: this.hostId,
              name: this.hostName,
              version: faker.system.semver(),
              buildId: faker.string.uuid(),
              channel: this.channel,
              framework: this.framework,
              remoteEntryUrl: this.remoteEntryUrl,
              exposes: { entry: './host' },
              requiredLoaderApiVersion: '^1.0.0',
              createdAt: faker.date.past().toISOString(),
            },
            apps: [],
          },
        );
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    error: (): unknown => this.error,
    hostId: (): string => this.hostId,
    result: (): AtlasHostCatalog | undefined => this.result,
  };
}
