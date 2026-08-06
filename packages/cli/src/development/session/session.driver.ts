import { faker } from '@faker-js/faker';
import { createTestManifest } from '@atlas/testkit';
import type { AtlasDevOverrideDocument } from '../types.js';
import { createDevSession, createLocalDevCatalog } from './session.js';

type SessionScenario = 'catalog' | 'session';

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
  };

  get = {
    catalog: () => ({
      appIds: [this.appId],
      generatedAt: this.generatedAt,
      hostId: this.hostId,
      schemaVersion: '1',
    }),
    session: () => ({
      catalogHostId: this.hostId,
      hostId: this.hostId,
      overrideUrl: this.overrideUrl,
    }),
    value: (): unknown => this.value,
  };
}
