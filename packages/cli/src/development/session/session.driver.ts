import { faker } from '@faker-js/faker';
import { createTestManifest } from '@atlas/testkit';
import type { AtlasDevOverrideDocument } from '../types.js';
import type { AtlasHostCatalog, AtlasHostManifest } from '@atlas/schema';
import {
  createDevSession,
  createDevSessionStore,
  createLocalDevCatalog,
} from './session.js';

type SessionScenario =
  'catalog' | 'merged-catalog' | 'registration' | 'session';

export class DevelopmentSessionDriver {
  private readonly appId = faker.string.uuid();
  private readonly hostId = faker.string.uuid();
  private readonly generatedAt = faker.date.past().toISOString();
  private readonly overrideUrl = faker.internet.url();
  private document?: AtlasDevOverrideDocument;
  private value?: unknown;

  given = {
    document: (scenario: SessionScenario): void => {
      const manifest = createTestManifest({
        channel: scenario === 'merged-catalog' ? 'local' : 'production',
        id: this.appId,
        placements: [
          {
            hostId: this.hostId,
            id: faker.string.uuid(),
            kind: 'route',
            route: { path: '/login', title: faker.lorem.words() },
          },
        ],
      });
      const overrides = [
        { appId: this.appId, manifest, reason: 'local' as const },
      ];

      this.document = {
        generatedAt: this.generatedAt,
        hostId: this.hostId,
        overrides:
          scenario === 'catalog'
            ? [
                ...overrides,
                {
                  appId: faker.string.uuid(),
                  manifest,
                  reason: 'local' as const,
                },
              ]
            : overrides,
        schemaVersion: '1',
      };
    },
  };

  when = {
    createCatalog: (): void => {
      if (!this.document) throw new Error('Session document is required.');

      const catalog = createLocalDevCatalog(this.document);

      this.value = {
        appIds: catalog.apps.map(({ id }) => id),
        generatedAt: catalog.generatedAt,
        hostId: catalog.hostId,
        schemaVersion: catalog.schemaVersion,
      };
    },
    createSession: (): void => {
      if (!this.document) throw new Error('Session document is required.');

      const catalog = createLocalDevCatalog(this.document);
      const session = createDevSession(
        this.document,
        catalog,
        this.overrideUrl,
      );

      this.value = {
        catalogHostId: session.catalog.hostId,
        hostId: session.hostId,
        overrideUrl: session.overrideUrl,
      };
    },
    refreshRegistration: (): void => {
      if (!this.document) throw new Error('Session document is required.');

      const session = createDevSessionStore(this.document, this.overrideUrl);
      session.markDocumentReady(this.document);
      session.register(this.document);

      const catalog = session.catalog(this.hostId);
      this.value = {
        appIds: catalog?.apps.map(({ id }) => id),
        generatedAt: catalog?.generatedAt,
        hostId: catalog?.hostId,
        schemaVersion: catalog?.schemaVersion,
      };
    },
    createMergedCatalog: (): void => {
      if (!this.document) throw new Error('Session document is required.');

      const session = createDevSessionStore(this.document, this.overrideUrl);
      session.markDocumentReady(this.document);
      const catalog = session.catalog(this.hostId, this.productionCatalog());
      this.value = {
        appIds: catalog?.apps.map(({ id }) => id),
        appChannels: catalog?.apps.map(({ channel }) => channel),
        hostChannel: catalog?.host.channel,
      };
    },
  };

  get = {
    catalog: () => ({
      appIds: [this.appId],
      generatedAt: this.generatedAt,
      hostId: this.hostId,
      schemaVersion: '1',
    }),
    mergedCatalog: () => ({
      appIds: [this.appId, 'published-app'],
      appChannels: ['local', 'production'],
      hostChannel: 'local',
    }),
    session: () => ({
      catalogHostId: this.hostId,
      hostId: this.hostId,
      overrideUrl: this.overrideUrl,
    }),
    value: (): unknown => this.value,
  };

  private productionCatalog(): AtlasHostCatalog {
    return {
      schemaVersion: '1',
      hostId: this.hostId,
      revision: 'production',
      generatedAt: this.generatedAt,
      host: this.hostManifest(),
      apps: [
        createTestManifest({ id: this.appId }),
        createTestManifest({ id: 'published-app' }),
      ],
    };
  }

  private hostManifest(): AtlasHostManifest {
    return {
      schemaVersion: '1',
      kind: 'host',
      id: this.hostId,
      name: 'Host',
      version: '1.0.0',
      buildId: 'production',
      channel: 'production',
      framework: 'react',
      createdAt: this.generatedAt,
      remoteEntryUrl: 'https://registry.example/host.js',
      exposes: { entry: './host' },
      requiredLoaderApiVersion: '^1.0.0',
    };
  }
}
