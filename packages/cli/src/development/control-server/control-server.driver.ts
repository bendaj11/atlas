import { faker } from '@faker-js/faker';
import type { AtlasHostCatalog } from '@atlas/schema';
import { aHostCatalog, aHostManifest, anAppManifest } from '@atlas/testkit';
import { anOverrideDocument } from '@atlas/testkit/internal';
import type { AtlasDevOverrideDocument, DevControlServer } from '../types.js';
import { startControlServer } from './control-server.js';

export class ControlServerDriver {
  private readonly appId = faker.string.uuid();
  private readonly hostId = faker.string.uuid();
  private readonly ownerAppId = faker.string.uuid();
  private readonly previewUrl = faker.internet.url();
  private app?: DevControlServer;
  private host?: DevControlServer;

  given = {
    runningApps: async () => {
      this.host = await startControlServer({
        port: 0,
        document: this.ownerAppDocument(),
        overrideUrl: faker.internet.url(),
      });
      await this.host.markReady();

      this.app = await startControlServer({
        port: this.host.port,
        document: this.appDocument(),
        overrideUrl: faker.internet.url(),
      });
      await this.app.markReady();
    },
    runningHostAndApp: async () => {
      this.host = await startControlServer({
        port: 0,
        document: this.hostDocument(),
        overrideUrl: faker.internet.url(),
      });
      await this.host.markReady();

      this.app = await startControlServer({
        port: this.host.port,
        document: this.appDocument(),
        overrideUrl: faker.internet.url(),
      });
      await this.app.markReady();
    },
    runningHostAndAppWithPublishedRegistry: async () => {
      this.host = await startControlServer({
        port: 0,
        document: this.hostDocument(),
        overrideUrl: faker.internet.url(),
        registryUrl: faker.internet.url(),
        loadPublishedCatalog: async () => this.publishedCatalog(),
      });
      await this.host.markReady();

      this.app = await startControlServer({
        port: this.host.port,
        document: this.appDocument(),
        overrideUrl: faker.internet.url(),
      });
      await this.app.markReady();
    },
  };

  when = {
    localHostRestartedBeforeAppRecovers: async () => {
      if (!this.host || !this.app)
        throw new Error('Running host and app are required.');

      const port = this.host.port;
      await this.host.close();
      this.host = await startControlServer({
        port,
        document: this.hostDocument(),
        overrideUrl: faker.internet.url(),
      });
      await this.host.markReady();
    },
    localHostRestartedAfterAppRecovered: async () => {
      if (!this.host || !this.app)
        throw new Error('Running host and app are required.');

      const port = this.host.port;
      await this.host.close();
      await this.app.reconcile();
      this.host = await startControlServer({
        port,
        document: this.hostDocument(),
        overrideUrl: faker.internet.url(),
      });
      await this.host.markReady();
    },
    ownerAppRestartedAfterAppRecovered: async () => {
      if (!this.host || !this.app)
        throw new Error('Running apps are required.');

      const port = this.host.port;
      await this.host.close();
      await this.app.reconcile();
      this.host = await startControlServer({
        port,
        document: this.ownerAppDocument(),
        overrideUrl: faker.internet.url(),
      });
      await this.host.markReady();
    },
    ownerAppRestartedBeforeAppRecovers: async () => {
      if (!this.host || !this.app)
        throw new Error('Running apps are required.');

      const port = this.host.port;
      await this.host.close();
      this.host = await startControlServer({
        port,
        document: this.ownerAppDocument(),
        overrideUrl: faker.internet.url(),
      });
      await this.host.markReady();
    },
    appStopped: async () => {
      if (!this.app) throw new Error('Running app is required.');

      await this.app.close();
      this.app = undefined;
    },
    ownerStoppedAndAppReconciled: async () => {
      if (!this.host || !this.app)
        throw new Error('Running host and app are required.');

      await this.host.close();
      await this.app.reconcile();
    },
    restartHostAndReconcileApp: async () => {
      if (!this.host || !this.app)
        throw new Error('Running host and app are required.');

      const port = this.host.port;
      await this.host.close();
      this.host = await startControlServer({
        port,
        document: this.hostDocument(),
        overrideUrl: faker.internet.url(),
      });
      await this.host.markReady();
      await this.app.reconcile();
    },
    close: async () => {
      await this.app?.close();
      await this.host?.close();
    },
  };

  get = {
    allAppIds: () => [this.appId, this.ownerAppId].sort(),
    appIds: () => [this.appId],
    ownerAppIds: () => [this.ownerAppId],
    catalogAppIds: async () => {
      if (!this.host) throw new Error('Host is required.');

      const response = await fetch(
        `http://localhost:${this.host.port}/atlas.dev-session.json?hostId=${this.hostId}`,
        { headers: { connection: 'close' } },
      );
      const session = (await response.json()) as {
        catalog: { apps: Array<{ id: string }> };
      };
      return session.catalog.apps.map(({ id }) => id).sort();
    },
    localHostAndAppState: async () => {
      if (!this.host) throw new Error('Host is required.');

      const response = await fetch(
        `http://localhost:${this.host.port}/atlas.dev-session.json?hostId=${this.hostId}`,
        { headers: { connection: 'close' } },
      );
      const session = (await response.json()) as {
        catalog: { apps: Array<{ id: string }>; host: { channel: string } };
      };
      return {
        appIds: session.catalog.apps.map(({ id }) => id).sort(),
        hostChannel: session.catalog.host.channel,
      };
    },
    publishedCatalogAppIds: () => [this.appId, 'published-app'],
    registryStatus: async () => {
      if (!this.host) throw new Error('Host is required.');
      return (
        await fetch(`http://localhost:${this.host.port}/registry.json`, {
          headers: { connection: 'close' },
        })
      ).status;
    },
    registeredPreviewSessionStatus: () =>
      this.previewStatus({
        pathname: '/atlas.dev-session.json',
        previewUrl: this.previewUrl,
      }),
    unregisteredPreviewSessionStatus: () =>
      this.previewStatus({
        pathname: '/atlas.dev-session.json',
        previewUrl: faker.internet.url(),
      }),
    previewLauncherStatus: (previewUrl: string) =>
      this.previewStatus({ pathname: '/atlas.open', previewUrl }),
    recoveredLocalHostAndAppState: () => ({
      appIds: [this.appId],
      hostChannel: 'local',
    }),
  };

  private publishedCatalog(): AtlasHostCatalog {
    return aHostCatalog({
      hostId: this.hostId,
      host: aHostManifest({ id: this.hostId, channel: 'production' }),
      apps: [
        anAppManifest({ id: this.appId, channel: 'production' }),
        anAppManifest({ id: 'published-app', channel: 'production' }),
      ],
    });
  }

  private appDocument(): AtlasDevOverrideDocument {
    return this.overrideDocumentFor(this.appId);
  }

  private ownerAppDocument(): AtlasDevOverrideDocument {
    return this.overrideDocumentFor(this.ownerAppId);
  }

  private hostDocument(): AtlasDevOverrideDocument {
    return {
      ...anOverrideDocument({ hostId: this.hostId }),
      hostOverride: aHostManifest({ id: this.hostId, channel: 'local' }),
      previewUrl: this.previewUrl,
    };
  }

  private overrideDocumentFor(appId: string): AtlasDevOverrideDocument {
    return {
      ...anOverrideDocument({
        hostId: this.hostId,
        overrides: [
          { appId, manifest: anAppManifest({ id: appId }), reason: 'local' },
        ],
      }),
      previewUrl: this.previewUrl,
    };
  }

  private async previewStatus({
    pathname,
    previewUrl,
  }: {
    pathname: string;
    previewUrl: string;
  }): Promise<number> {
    if (!this.host) throw new Error('Host is required.');
    const url = new URL(pathname, `http://localhost:${this.host.port}`);
    url.searchParams.set('hostId', this.hostId);
    url.searchParams.set('previewUrl', previewUrl);
    return (await fetch(url, { headers: { connection: 'close' } })).status;
  }
}
