import { createServer, type Server } from 'node:http';
import { faker } from '@faker-js/faker';
import type { AtlasHostCatalog, AtlasHostManifest } from '@atlas/schema';
import { createTestManifest } from '@atlas/testkit';
import type { AtlasDevOverrideDocument, DevControlServer } from '../types.js';
import { startControlServer } from './control-server.js';

export class ControlServerDriver {
  private readonly appId = faker.string.uuid();
  private readonly hostId = faker.string.uuid();
  private app?: DevControlServer;
  private host?: DevControlServer;
  private registry?: Server;
  private registryUrl?: string;

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
    runningHostAndAppWithPublishedRegistry: async (): Promise<void> => {
      this.registryUrl = await this.startPublishedRegistry();
      this.host = await startControlServer(
        0,
        this.hostDocument(),
        faker.internet.url(),
        this.registryUrl,
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
      await this.closeRegistry();
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
    publishedCatalogAppIds: (): string[] => [this.appId, 'published-app'],
    appVersionChannels: async (): Promise<string[]> => {
      if (!this.host) throw new Error('Host is required.');

      const response = await fetch(
        `http://localhost:${this.host.port}/apps/${this.appId}/index.json`,
        { headers: { connection: 'close' } },
      );
      const index = (await response.json()) as {
        manifests: Array<{ channel: string }>;
      };
      return index.manifests.map(({ channel }) => channel);
    },
  };

  private async startPublishedRegistry(): Promise<string> {
    this.registry = createServer((request, response) => {
      const path = request.url ?? '';
      if (path === `/hosts/${this.hostId}/catalog.json`) {
        response.end(JSON.stringify(this.publishedCatalog()));
        return;
      }
      if (path === `/apps/${this.appId}/index.json`) {
        response.end(
          JSON.stringify({
            manifests: [
              createTestManifest({ id: this.appId, channel: 'production' }),
              createTestManifest({ id: this.appId, channel: 'pr' }),
            ],
          }),
        );
        return;
      }
      response.statusCode = 404;
      response.end();
    });
    await new Promise<void>((resolve, reject) => {
      this.registry?.once('error', reject);
      this.registry?.listen(0, '127.0.0.1', resolve);
    });
    const address = this.registry.address();
    if (!address || typeof address === 'string')
      throw new Error('Published registry did not receive a TCP port.');
    return `http://127.0.0.1:${address.port}`;
  }

  private async closeRegistry(): Promise<void> {
    if (!this.registry?.listening) return;
    await new Promise<void>((resolve, reject) =>
      this.registry?.close((error) => (error ? reject(error) : resolve())),
    );
  }

  private publishedCatalog(): AtlasHostCatalog {
    return {
      schemaVersion: '1',
      hostId: this.hostId,
      revision: 'production',
      generatedAt: faker.date.past().toISOString(),
      host: {
        ...this.hostManifest(),
        buildId: 'production',
        channel: 'production',
      },
      apps: [
        createTestManifest({ id: this.appId, channel: 'production' }),
        createTestManifest({ id: 'published-app', channel: 'production' }),
      ],
    };
  }

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
