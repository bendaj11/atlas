import { faker } from '@faker-js/faker';
import { createTestManifest } from '@atlas/testkit';
import { startControlServer } from '../src/development/control-server/control-server.js';
import type {
  AtlasDevOverrideDocument,
  DevControlServer,
} from '../src/development/types.js';

export class ControlServerDriver {
  private readonly firstAppId = faker.string.uuid();
  private readonly secondAppId = faker.string.uuid();
  private readonly hostId = faker.string.uuid();
  private first?: DevControlServer;
  private second?: DevControlServer;
  private timeline?: unknown;

  when = {
    close: async (): Promise<void> => {
      await this.second?.close();
      await this.first?.close();
    },
    coordinateApps: async (): Promise<void> => {
      this.first = await startControlServer({
        port: 0,
        document: this.document(this.firstAppId),
        overrideUrl: '',
      });
      await this.first.markReady();
      const initial = await this.catalogIds();

      this.second = await startControlServer({
        port: this.first.port,
        document: this.document(this.secondAppId),
        overrideUrl: '',
      });
      await this.second.markReady();
      const joined = await this.catalogIds();

      await this.second.close();
      this.second = undefined;
      const departed = await this.catalogIds();

      this.timeline = { departed, initial, joined };
    },
  };

  get = {
    timeline: (): unknown => this.timeline,
  };

  private document(appId: string): AtlasDevOverrideDocument {
    const manifest = createTestManifest({
      id: appId,
      placements: [
        {
          hostId: this.hostId,
          id: faker.string.uuid(),
          kind: 'route',
          route: { path: `/${appId}`, title: faker.lorem.words() },
        },
      ],
    });

    return {
      generatedAt: faker.date.past().toISOString(),
      hostId: this.hostId,
      overrides: [{ appId, manifest, reason: 'local' }],
      schemaVersion: '1',
    };
  }

  private async catalogIds(): Promise<string[]> {
    if (!this.first) throw new Error('Control server setup is required.');

    const response = await fetch(
      `http://localhost:${this.first.port}/atlas.dev-session.json?hostId=${this.hostId}`,
    );
    const session = (await response.json()) as {
      catalog: { apps: Array<{ id: string }> };
    };

    return session.catalog.apps.map(({ id }) =>
      id === this.firstAppId
        ? 'first'
        : id === this.secondAppId
          ? 'second'
          : id,
    );
  }
}
