import { faker } from '@faker-js/faker';
import type { AtlasHostManifest } from '@atlas/schema';
import { createTestManifest } from '@atlas/testkit';
import type { AtlasDevOverrideDocument, DevControlServer } from '../types.js';
import { startControlServer } from './control-server.js';

export class ControlServerDriver {
  private readonly appId = faker.string.uuid();
  private readonly hostId = faker.string.uuid();
  private app?: DevControlServer;
  private host?: DevControlServer;

  given = {
    runningHostAndApp: async (): Promise<void> => {
      this.host = await startControlServer(
        0,
        this.hostDocument(),
        faker.internet.url(),
      );
      await this.host.markReady();

      this.app = await startControlServer(
        this.host.port,
        this.appDocument(),
        faker.internet.url(),
      );
      await this.app.markReady();
    },
  };

  when = {
    restartHostAndReconcileApp: async (): Promise<void> => {
      if (!this.host || !this.app)
        throw new Error('Running host and app are required.');

      const port = this.host.port;
      await this.host.close();
      this.host = await startControlServer(
        port,
        this.hostDocument(),
        faker.internet.url(),
      );
      await this.host.markReady();
      await this.app.reconcile();
    },
    close: async (): Promise<void> => {
      await this.app?.close();
      await this.host?.close();
    },
  };

  get = {
    appIds: (): string[] => [this.appId],
    catalogAppIds: async (): Promise<string[]> => {
      if (!this.host) throw new Error('Host is required.');

      const response = await fetch(
        `http://localhost:${this.host.port}/hosts/${this.hostId}/catalog.json`,
        { headers: { connection: 'close' } },
      );
      const catalog = (await response.json()) as {
        apps: Array<{ id: string }>;
      };
      return catalog.apps.map(({ id }) => id);
    },
  };

  private appDocument(): AtlasDevOverrideDocument {
    return {
      generatedAt: faker.date.past().toISOString(),
      hostId: this.hostId,
      overrides: [
        {
          appId: this.appId,
          manifest: createTestManifest({ id: this.appId }),
          reason: 'local',
        },
      ],
      schemaVersion: '1',
    };
  }

  private hostDocument(): AtlasDevOverrideDocument {
    return {
      generatedAt: faker.date.past().toISOString(),
      hostId: this.hostId,
      hostOverride: this.hostManifest(),
      overrides: [],
      schemaVersion: '1',
    };
  }

  private hostManifest(): AtlasHostManifest {
    return {
      buildId: faker.string.uuid(),
      channel: 'local',
      createdAt: faker.date.past().toISOString(),
      exposes: { entry: './host' },
      framework: 'react',
      id: this.hostId,
      kind: 'host',
      name: faker.company.name(),
      remoteEntryUrl: faker.internet.url(),
      requiredLoaderApiVersion: '^1.0.0',
      schemaVersion: '1',
      version: faker.system.semver(),
    };
  }
}
