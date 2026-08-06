import { access, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { faker } from '@faker-js/faker';
import {
  assertAtlasHostCatalog,
  type AtlasHostCatalog,
  type AtlasHostManifest,
  type AtlasManifest,
  type AtlasStaticRegistry,
} from '@atlas/schema';
import { createTestManifest } from '@atlas/testkit';
import {
  createHostCatalog,
  prepareStaticRegistry,
  prepareStaticRollback,
  registryRevision,
} from './static-registry.js';

type RegistryScenario =
  | 'selected-app'
  | 'provider-only'
  | 'stable-catalog'
  | 'pr-history'
  | 'replace-pr'
  | 'rollback-host'
  | 'ambiguous-rollback'
  | 'artifact-order';

export class StaticRegistryDriver {
  private readonly appId = faker.word.noun().toLowerCase();
  private readonly secondAppId = faker.word.noun().toLowerCase();
  private readonly hostId = faker.word.noun().toLowerCase();
  private directory = '';
  private observation?: unknown;
  private action?: () => Promise<void>;

  given = {
    registry: async (scenario: RegistryScenario): Promise<void> => {
      this.directory = await mkdtemp(join(tmpdir(), 'atlas-static-registry-'));

      if (scenario === 'selected-app') await this.prepareSelectedApp();
      if (scenario === 'provider-only') await this.prepareProviderOnly();
      if (scenario === 'stable-catalog') this.prepareStableCatalog();
      if (scenario === 'pr-history') await this.preparePrHistory();
      if (scenario === 'replace-pr') await this.preparePrReplacement();
      if (scenario === 'rollback-host') await this.prepareHostRollback();
      if (scenario === 'ambiguous-rollback') this.prepareAmbiguousRollback();
      if (scenario === 'artifact-order') this.prepareArtifactOrder();
    },
  };

  when = {
    rollback: async (): Promise<void> => {
      if (!this.action) throw new Error('Rollback setup is required.');

      await this.action();
    },
  };

  get = {
    observation: <T>(): T => this.observation as T,
  };

  private async prepareSelectedApp(): Promise<void> {
    await prepareStaticRegistry(this.hostManifest(), undefined, this.directory);
    const afterHost = await this.readRegistry('registry.json');

    await prepareStaticRegistry(this.appManifest(), afterHost, this.directory);

    const index = await this.readManifestIndex(`apps/${this.appId}/index.json`);
    const catalog = await this.readCatalog(`hosts/${this.hostId}/catalog.json`);

    this.observation = {
      catalogContainsApp: catalog.apps.some(({ id }) => id === this.appId),
      catalogKind: catalog.host.kind,
      indexContainsApp: index.manifests.some(({ id }) => id === this.appId),
    };
  }

  private async prepareProviderOnly(): Promise<void> {
    await prepareStaticRegistry(this.hostManifest(), undefined, this.directory);
    const afterHost = await this.readRegistry('registry.json');
    const provider = createTestManifest({
      exportedWidgets: [
        {
          contractVersion: '1',
          expose: './shared-summary',
          framework: 'react',
          id: faker.string.uuid(),
          name: faker.commerce.productName(),
          ownerAppId: this.appId,
          remoteEntryUrl: faker.internet.url(),
          schemaVersion: '1',
        },
      ],
      id: this.appId,
      placements: [],
      supportedHosts: ['*'],
    });

    await prepareStaticRegistry(provider, afterHost, this.directory);

    const registry = await this.readRegistry('registry.json');
    const catalog = await this.readCatalog(`hosts/${this.hostId}/catalog.json`);

    this.observation = {
      catalogApps: catalog.apps,
      providerIsDiscoverable: registry.apps.some(
        ({ id }) => id === provider.id,
      ),
    };
  }

  private prepareStableCatalog(): void {
    const host = this.hostManifest();
    const before: AtlasStaticRegistry = {
      apps: [],
      hosts: [host],
      schemaVersion: '1',
      selections: {
        apps: {},
        hosts: {
          [this.hostId]: { buildId: host.buildId, version: host.version },
        },
      },
      updatedAt: host.createdAt,
    };
    const provider = createTestManifest({
      createdAt: '2026-02-01T00:00:00.000Z',
      id: this.appId,
      placements: [],
      supportedHosts: ['*'],
    });
    const after: AtlasStaticRegistry = {
      ...before,
      apps: [provider],
      selections: {
        apps: {
          [this.appId]: {
            buildId: provider.buildId,
            version: provider.version,
          },
        },
        hosts: before.selections!.hosts,
      },
      updatedAt: provider.createdAt,
    };

    this.observation =
      JSON.stringify(createHostCatalog(this.hostId, after)) ===
      JSON.stringify(createHostCatalog(this.hostId, before));
  }

  private async preparePrHistory(): Promise<void> {
    await prepareStaticRegistry(this.hostManifest(), undefined, this.directory);
    let current = await this.readRegistry('registry.json');

    await prepareStaticRegistry(
      this.appManifest({
        buildId: 'one',
        version: '1.0.0',
      }),
      current,
      this.directory,
    );
    current = await this.readRegistry('registry.json');

    const result = await prepareStaticRegistry(
      this.appManifest({
        buildId: 'pr',
        channel: 'pr',
        prNumber: 1,
        version: '2.0.0-pr.1',
      }),
      current,
      this.directory,
    );
    const index = await this.readManifestIndex(`apps/${this.appId}/index.json`);
    const catalog = await this.readCatalog(`hosts/${this.hostId}/catalog.json`);

    this.observation = {
      activeVersion: catalog.apps[0]?.version,
      hostIds: result.hostIds,
      manifestCount: index.manifests.length,
    };
  }

  private async preparePrReplacement(): Promise<void> {
    const first = this.appManifest({
      buildId: 'first',
      channel: 'pr',
      gitSha: faker.git.commitSha(),
      prNumber: 8,
      version: '1.0.0-pr.8',
    });

    await prepareStaticRegistry(first, undefined, this.directory);

    const current = await this.readRegistry('registry.json');
    const second = this.appManifest({
      buildId: 'second',
      channel: 'pr',
      gitSha: faker.git.commitSha(),
      prNumber: 8,
      version: '1.0.0-pr.8',
    });
    const result = await prepareStaticRegistry(second, current, this.directory);
    const index = await this.readManifestIndex(`apps/${this.appId}/index.json`);

    this.observation = {
      currentBuilds: index.manifests.map(({ buildId }) => buildId),
      replacedBuilds: result.replaced.map(({ buildId }) => buildId),
    };
  }

  private async prepareHostRollback(): Promise<void> {
    const first = this.hostManifest({ buildId: 'one', version: '1.0.0' });
    const second = this.hostManifest({ buildId: 'two', version: '2.0.0' });

    await prepareStaticRegistry(first, undefined, this.directory);

    let current = await this.readRegistry('registry.json');
    const app = this.appManifest({
      buildId: 'orders-three',
      version: '3.0.0',
    });

    await prepareStaticRegistry(app, current, this.directory);
    current = await this.readRegistry('registry.json');
    await prepareStaticRegistry(second, current, this.directory);
    current = await this.readRegistry('registry.json');

    const result = await prepareStaticRollback({
      artifactId: this.hostId,
      current,
      outputDirectory: this.directory,
      updatedAt: '2026-02-01T00:00:00.000Z',
      version: '1.0.0',
    });
    const catalog = await this.readCatalog(`hosts/${this.hostId}/catalog.json`);
    let deploymentExists = true;

    try {
      await access(
        join(
          this.directory,
          `hosts/${this.hostId}/deployments/${catalog.revision.replace(':', '-')}.json`,
        ),
      );
    } catch {
      deploymentExists = false;
    }

    this.observation = {
      appBuildId: catalog.apps.find(({ id }) => id === this.appId)?.buildId,
      deploymentExists,
      hostBuildId: catalog.host.buildId,
      selectedKind: result.selected.kind,
    };
  }

  private prepareAmbiguousRollback(): void {
    const first = this.appManifest({
      buildId: 'one',
      version: '1.0.0',
    });
    const rebuilt = this.appManifest({
      buildId: 'two',
      version: '1.0.0',
    });
    const current: AtlasStaticRegistry = {
      apps: [first, rebuilt],
      hosts: [this.hostManifest()],
      schemaVersion: '1',
      updatedAt: first.createdAt,
    };
    current.revision = registryRevision(current);

    this.action = async () => {
      await prepareStaticRollback({
        artifactId: first.id,
        current,
        outputDirectory: this.directory,
        version: first.version,
      });
    };
  }

  private prepareArtifactOrder(): void {
    const host = this.hostManifest();
    const first = this.appManifest();
    const second = this.appManifest({ id: this.secondAppId });
    const left: AtlasStaticRegistry = {
      apps: [first, second],
      hosts: [host],
      schemaVersion: '1',
      updatedAt: first.createdAt,
    };
    const right: AtlasStaticRegistry = {
      ...left,
      apps: [second, first],
    };

    this.observation = registryRevision(left) === registryRevision(right);
  }

  private hostManifest(
    overrides: Partial<AtlasHostManifest> = {},
  ): AtlasHostManifest {
    return {
      buildId: 'host-build',
      channel: 'production',
      createdAt: '2026-01-01T00:00:00.000Z',
      exposes: { entry: './host' },
      framework: 'react',
      id: this.hostId,
      kind: 'host',
      name: faker.company.name(),
      remoteEntryUrl: faker.internet.url(),
      requiredLoaderApiVersion: '^1.0.0',
      schemaVersion: '1',
      version: '1.0.0',
      ...overrides,
    };
  }

  private appManifest(overrides: Partial<AtlasManifest> = {}): AtlasManifest {
    return createTestManifest({
      id: this.appId,
      placements: [
        {
          hostId: this.hostId,
          id: faker.string.uuid(),
          kind: 'route',
          route: {
            path: `/${this.appId}`,
            title: faker.commerce.department(),
          },
        },
      ],
      ...overrides,
    });
  }

  private async readCatalog(path: string): Promise<AtlasHostCatalog> {
    const value = await this.readJson(path);

    assertAtlasHostCatalog(value);

    return value;
  }

  private async readRegistry(path: string): Promise<AtlasStaticRegistry> {
    return (await this.readJson(path)) as AtlasStaticRegistry;
  }

  private async readManifestIndex(
    path: string,
  ): Promise<{ manifests: AtlasManifest[] }> {
    return (await this.readJson(path)) as { manifests: AtlasManifest[] };
  }

  private async readJson(path: string): Promise<unknown> {
    return JSON.parse(await readFile(join(this.directory, path), 'utf8'));
  }
}
