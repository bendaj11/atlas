import type { AtlasHostManifest } from '@atlas/schema';
import { faker } from '../test-utils/faker.js';
import { validateArtifactUrl, validateHostManifest } from './validation.js';

export class ValidationDriver {
  private error: unknown;
  private readonly schemaVersion = faker.custom.schemaVersion();
  private readonly channel = faker.custom.publishedChannel();
  private readonly framework = faker.custom.framework();
  private readonly hostId = faker.string.uuid();
  private readonly assetOrigin = new URL(faker.internet.url()).origin;
  private readonly bootstrapUrl = faker.internet.url();
  private manifest: AtlasHostManifest = {
    schemaVersion: this.schemaVersion,
    kind: 'host',
    id: this.hostId,
    name: faker.company.name(),
    version: faker.system.semver(),
    buildId: faker.string.uuid(),
    channel: this.channel,
    framework: this.framework,
    remoteEntryUrl: this.assetOrigin + '/' + faker.system.fileName(),
    exposes: { entry: './host' },
    requiredLoaderApiVersion: '^1.0.0',
    createdAt: faker.date.past().toISOString(),
  };
  private url = new URL(this.manifest.remoteEntryUrl);

  readonly given = {
    approvedHostArtifact: (location: URL): ValidationDriver => {
      Object.assign(globalThis, {
        location,
      });
      return this;
    },
    unapprovedHostArtifact: (url: URL): ValidationDriver => {
      Object.assign(globalThis, {
        location: new URL(this.bootstrapUrl),
      });
      this.url = url;
      return this;
    },
    incompatibleLoaderApi: (
      requiredLoaderApiVersion: string,
    ): ValidationDriver => {
      Object.assign(globalThis, {
        location: new URL(this.bootstrapUrl),
      });
      this.manifest = { ...this.manifest, requiredLoaderApiVersion };
      return this;
    },
    localLoopbackArtifact: (url: URL): ValidationDriver => {
      Object.assign(globalThis, {
        location: new URL(this.bootstrapUrl),
      });
      this.manifest = { ...this.manifest, channel: 'local' };
      this.url = url;
      return this;
    },
    localRemoteArtifact: (url: URL): ValidationDriver => {
      Object.assign(globalThis, {
        location: new URL(this.bootstrapUrl),
      });
      this.manifest = { ...this.manifest, channel: 'local' };
      this.url = url;
      return this;
    },
  };

  readonly when = {
    validateHost: (): void => {
      try {
        validateHostManifest(this.manifest, {
          schemaVersion: this.schemaVersion,
          hostId: this.hostId,
          catalogUrl: this.bootstrapUrl,
          assetOrigins: [this.assetOrigin],
        });
      } catch (error) {
        this.error = error;
      }
    },
    validateArtifact: (): void => {
      try {
        validateArtifactUrl(this.url, this.manifest, {
          schemaVersion: this.schemaVersion,
          hostId: this.hostId,
          catalogUrl: this.bootstrapUrl,
          assetOrigins: [this.assetOrigin],
        });
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    error: (): unknown => this.error,
  };
}
