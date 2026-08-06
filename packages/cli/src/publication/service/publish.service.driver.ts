import {
  access,
  mkdir,
  mkdtemp,
  open,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { faker } from '@faker-js/faker';
import { createTestManifest } from '@atlas/testkit';
import { CliArguments } from '../../cli/arguments.js';
import { registryRevision } from '../static-registry/static-registry.js';
import type {
  AtlasProjectBuilder,
  AtlasPublicationLease,
  AtlasPublicationObjectMetadata,
  AtlasPublicationStorage,
} from './publish.service.js';
import { AtlasPublishService } from './publish.service.js';
import { publicationContentType } from '../publication-metadata/publication-metadata.js';

type PublishScenario =
  | 'publish'
  | 'missing-storage'
  | 'dry-run'
  | 'verification-failure'
  | 'verification-cleanup'
  | 'sequencing'
  | 'mutable-failure'
  | 'mutable-cleanup'
  | 'rollback'
  | 'lease-loss'
  | 'lease-cleanup'
  | 'moved-head'
  | 'latest-pr'
  | 'remove-pr'
  | 'prune-pr';

export class PublishServiceDriver {
  private readonly appId = faker.word.noun().toLowerCase();
  private readonly prNumber = faker.number.int({ min: 1, max: 999 });
  private scenario?: PublishScenario;
  private fixture?: Awaited<ReturnType<typeof publicationFixture>>;
  private observation?: unknown;

  given = {
    publication: async (scenario: PublishScenario): Promise<void> => {
      this.scenario = scenario;
      this.fixture = await publicationFixture(this.appId);
    },
  };

  when = {
    run: async (): Promise<void> => {
      if (!this.fixture || !this.scenario) {
        throw new Error('Publication setup is required.');
      }

      if (this.scenario === 'publish') await this.publish();
      if (this.scenario === 'missing-storage')
        await this.publishWithoutStorage();
      if (this.scenario === 'dry-run') await this.publishDryRun();
      if (this.scenario === 'verification-failure') {
        await this.publishWithVerificationFailure(false);
      }
      if (this.scenario === 'verification-cleanup') {
        await this.publishWithVerificationFailure(true);
      }
      if (this.scenario === 'sequencing') await this.publishWithHooks();
      if (this.scenario === 'mutable-failure') {
        await this.publishWithMutableFailure(false);
      }
      if (this.scenario === 'mutable-cleanup') {
        await this.publishWithMutableFailure(true);
      }
      if (this.scenario === 'rollback') await this.rollback();
      if (this.scenario === 'lease-loss')
        await this.publishWithLeaseLoss(false);
      if (this.scenario === 'lease-cleanup')
        await this.publishWithLeaseLoss(true);
      if (this.scenario === 'moved-head') await this.publishMovedHead();
      if (this.scenario === 'latest-pr') await this.publishLatestPr();
      if (this.scenario === 'remove-pr') await this.removePr();
      if (this.scenario === 'prune-pr') await this.prunePr();
    },
  };

  get = {
    observation: <T>(): T => this.observation as T,
  };

  private service(arguments_: string[] = ['publish'], builds = this.builds) {
    return new AtlasPublishService(new CliArguments(arguments_), builds);
  }

  private get builds(): AtlasProjectBuilder {
    if (!this.fixture) throw new Error('Publication fixture is required.');

    return this.fixture.builds;
  }

  private get storageRoot(): string {
    if (!this.fixture) throw new Error('Publication fixture is required.');

    return this.fixture.storage;
  }

  private async publish(): Promise<void> {
    const result = await this.service().run(this.appId, {
      config: { storage: new DirectoryPublicationStorage(this.storageRoot) },
    });
    const entry = await readFile(
      join(this.storageRoot, `apps/${this.appId}/1.0.0/build-1/entry.js`),
      'utf8',
    );

    this.observation = {
      entry,
      uploaded: result.uploaded.map((path) =>
        path.replace(this.appId, '{appId}'),
      ),
    };
  }

  private async publishWithoutStorage(): Promise<void> {
    await this.service().run(this.appId);
  }

  private async publishDryRun(): Promise<void> {
    const result = await this.service(['publish', '--dry-run']).run(this.appId);

    this.observation = result.dryRun;
  }

  private async publishWithVerificationFailure(
    capture: boolean,
  ): Promise<void> {
    const previousRegistry = this.emptyRegistryText();

    await mkdir(this.storageRoot, { recursive: true });
    await writeFile(join(this.storageRoot, 'registry.json'), previousRegistry);

    const action = this.service().run(this.appId, {
      config: { storage: new DirectoryPublicationStorage(this.storageRoot) },
      verify: async () => {
        throw new Error('smoke test failed');
      },
    });

    if (!capture) {
      await action;
      return;
    }

    await action.catch(() => undefined);

    this.observation = {
      immutableExists: await this.exists(
        `apps/${this.appId}/1.0.0/build-1/entry.js`,
      ),
      registryRestored:
        (await readFile(join(this.storageRoot, 'registry.json'), 'utf8')) ===
        previousRegistry,
    };
  }

  private async publishWithHooks(): Promise<void> {
    const events: string[] = [];

    await this.service().run(this.appId, {
      config: {
        invalidate(paths) {
          events.push(`invalidate:${paths.join(',')}`);
        },
        storage: () => new DirectoryPublicationStorage(this.storageRoot),
      },
      verify: async () => {
        events.push('verify');
      },
    });

    this.observation = events.map((event) =>
      event.replace(this.appId, '{appId}'),
    );
  }

  private async publishWithMutableFailure(capture: boolean): Promise<void> {
    const storage = new FailingMutableStorage(`apps/${this.appId}/index.json`);
    const previousRegistry = this.emptyRegistryText();
    storage.seed('registry.json', previousRegistry);

    const action = this.service().run(this.appId, { config: { storage } });

    if (!capture) {
      await action;
      return;
    }

    await action.catch(() => undefined);

    this.observation = {
      index: storage.text(`apps/${this.appId}/index.json`),
      registryRestored: storage.text('registry.json') === previousRegistry,
    };
  }

  private async rollback(): Promise<void> {
    const first = createTestManifest({
      buildId: 'stable',
      id: this.appId,
      version: '1.0.0',
    });
    const second = createTestManifest({
      buildId: 'latest',
      id: this.appId,
      version: '2.0.0',
    });
    const registry = {
      apps: [first, second],
      hosts: [],
      schemaVersion: '1' as const,
      selections: {
        apps: {
          [this.appId]: { buildId: 'latest', version: '2.0.0' },
        },
        hosts: {},
      },
      updatedAt: second.createdAt,
    };

    await mkdir(this.storageRoot, { recursive: true });
    await writeFile(
      join(this.storageRoot, 'registry.json'),
      JSON.stringify({ ...registry, revision: registryRevision(registry) }),
    );

    const result = await this.service([
      'rollback',
      this.appId,
      '--version=1.0.0',
    ]).rollback(this.appId, '1.0.0', {
      config: { storage: new DirectoryPublicationStorage(this.storageRoot) },
    });
    const published = JSON.parse(
      await readFile(join(this.storageRoot, 'registry.json'), 'utf8'),
    );

    this.observation = {
      buildId: result.buildId,
      selection: published.selections.apps[this.appId],
    };
  }

  private async publishWithLeaseLoss(capture: boolean): Promise<void> {
    const storage = new LeaseLossStorage(this.storageRoot, 5);
    const action = this.service().run(this.appId, { config: { storage } });

    if (!capture) {
      await action;
      return;
    }

    await action.catch(() => undefined);

    this.observation = {
      indexExists: await this.exists(`apps/${this.appId}/index.json`),
      registryExists: await this.exists('registry.json'),
    };
  }

  private async publishMovedHead(): Promise<void> {
    const original = await this.builds.build(this.appId);
    const oldSha = faker.git.commitSha();
    const newSha = faker.git.commitSha();
    const builds: AtlasProjectBuilder = {
      build: async () => ({
        ...original,
        manifest: {
          ...original.manifest,
          channel: 'pr',
          gitSha: oldSha,
          prNumber: this.prNumber,
        },
      }),
    };
    const result = await this.service(['publish'], builds).run(this.appId, {
      config: {
        resolvePullRequest: async () => ({ headSha: newSha, state: 'open' }),
        storage: new DirectoryPublicationStorage(this.storageRoot),
      },
    });

    this.observation = {
      registryExists: await this.exists('registry.json'),
      skipped: result.skippedReason?.includes(`${oldSha} to ${newSha}`),
    };
  }

  private async publishLatestPr(): Promise<void> {
    const original = await this.builds.build(this.appId);
    const firstSha = faker.git.commitSha();
    const firstManifest = {
      ...original.manifest,
      buildId: 'first',
      channel: 'pr' as const,
      gitSha: firstSha,
      prNumber: this.prNumber,
      version: `1.0.0-pr.${this.prNumber}`,
    };
    const storage = new DirectoryPublicationStorage(this.storageRoot);

    await this.service(['publish'], {
      build: async () => ({ ...original, manifest: firstManifest }),
    }).run(this.appId, {
      config: {
        resolvePullRequest: async () => ({ headSha: firstSha, state: 'open' }),
        storage,
      },
    });

    const secondSha = faker.git.commitSha();
    const secondManifest = {
      ...firstManifest,
      buildId: 'second',
      gitSha: secondSha,
    };
    const result = await this.service(['publish'], {
      build: async () => ({ ...original, manifest: secondManifest }),
    }).run(this.appId, {
      config: {
        resolvePullRequest: async () => ({ headSha: secondSha, state: 'open' }),
        storage,
      },
    });
    const registry = JSON.parse(
      await readFile(join(this.storageRoot, 'registry.json'), 'utf8'),
    );

    this.observation = {
      buildIds: registry.apps.map(
        ({ buildId }: { buildId: string }) => buildId,
      ),
      cleanupWarnings: result.cleanupWarnings,
      firstExists: await this.exists(
        `apps/${this.appId}/1.0.0-pr.${this.prNumber}/first/entry.js`,
      ),
      secondExists: await this.exists(
        `apps/${this.appId}/1.0.0-pr.${this.prNumber}/second/entry.js`,
      ),
    };
  }

  private async removePr(): Promise<void> {
    const original = await this.builds.build(this.appId);
    const sha = faker.git.commitSha();
    const manifest = {
      ...original.manifest,
      buildId: 'preview',
      channel: 'pr' as const,
      gitSha: sha,
      prNumber: this.prNumber,
      version: `1.0.0-pr.${this.prNumber}`,
    };
    const builds: AtlasProjectBuilder = {
      build: async () => ({ ...original, manifest }),
    };
    const storage = new DirectoryPublicationStorage(this.storageRoot);

    await this.service(['publish'], builds).run(this.appId, {
      config: {
        resolvePullRequest: async () => ({ headSha: sha, state: 'open' }),
        storage,
      },
    });

    const result = await this.service(['remove-pr'], builds).removePr(
      [this.appId],
      this.prNumber,
      { config: { storage } },
    );
    const registry = JSON.parse(
      await readFile(join(this.storageRoot, 'registry.json'), 'utf8'),
    );

    this.observation = {
      artifactExists: await this.exists(
        `apps/${this.appId}/1.0.0-pr.${this.prNumber}/preview/entry.js`,
      ),
      registryApps: registry.apps,
      removedBuilds: result.removedBuilds,
    };
  }

  private async prunePr(): Promise<void> {
    const original = await this.builds.build(this.appId);
    const sha = faker.git.commitSha();
    const manifest = {
      ...original.manifest,
      buildId: 'preview',
      channel: 'pr' as const,
      gitSha: sha,
      prNumber: this.prNumber,
      version: `1.0.0-pr.${this.prNumber}`,
    };
    const builds: AtlasProjectBuilder = {
      build: async () => ({ ...original, manifest }),
    };
    const storage = new DirectoryPublicationStorage(this.storageRoot);

    await this.service(['publish'], builds).run(this.appId, {
      config: {
        resolvePullRequest: async () => ({ headSha: sha, state: 'open' }),
        storage,
      },
    });

    const service = this.service(['prune-prs'], builds);
    const preserved = await service.prunePrs(
      [this.appId],
      new Set([this.prNumber]),
      { config: { storage } },
    );
    const removed = await service.prunePrs([this.appId], new Set(), {
      config: { storage },
    });

    this.observation = {
      preserved: preserved.removedBuilds,
      removed: removed.removedBuilds,
    };
  }

  private emptyRegistryText(): string {
    const registry = {
      apps: [],
      hosts: [],
      schemaVersion: '1' as const,
      selections: { apps: {}, hosts: {} },
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    return `${JSON.stringify({ ...registry, revision: registryRevision(registry) })}\n`;
  }

  private async exists(path: string): Promise<boolean> {
    try {
      await access(join(this.storageRoot, path));
      return true;
    } catch {
      return false;
    }
  }
}

async function publicationFixture(appId: string) {
  const root = await mkdtemp(join(tmpdir(), 'atlas-publish-'));
  const source = join(root, 'build');
  const storage = join(root, 'storage');
  await mkdir(source, { recursive: true });
  await writeFile(join(source, 'entry.js'), 'export {};\n');
  const manifest = createTestManifest({
    id: appId,
    version: '1.0.0',
    buildId: 'build-1',
    remoteEntryUrl: `https://cdn.example/apps/${appId}/1.0.0/build-1/entry.js`,
  });
  const builds: AtlasProjectBuilder = {
    async build() {
      return {
        artifact: 'app',
        manifest,
        project: {
          id: appId,
          root,
          packageName: appId,
          version: '1.0.0',
          outputPaths: [source],
        },
        sourceDirectory: source,
        files: ['entry.js'],
      };
    },
  };
  return { builds, storage };
}

class DirectoryPublicationStorage implements AtlasPublicationStorage {
  private readonly lockPath: string;
  private readonly metadata = new Map<string, AtlasPublicationObjectMetadata>();

  constructor(private readonly root: string) {
    this.lockPath = join(root, '.atlas-deployment.lock');
  }

  async read(path: string): Promise<Uint8Array | undefined> {
    try {
      return await readFile(join(this.root, path));
    } catch (error) {
      if (isMissingFile(error)) return undefined;
      throw error;
    }
  }

  async inspect(
    path: string,
  ): Promise<AtlasPublicationObjectMetadata | undefined> {
    if (!(await this.read(path))) return undefined;
    return (
      this.metadata.get(path) ?? {
        cacheControl: 'no-cache',
        contentType: publicationContentType(path),
      }
    );
  }

  async create(
    path: string,
    bytes: Uint8Array,
    metadata: AtlasPublicationObjectMetadata,
  ): Promise<void> {
    const target = join(this.root, path);
    await mkdir(join(target, '..'), { recursive: true });
    const handle = await open(target, 'wx');
    try {
      await handle.writeFile(bytes);
    } finally {
      await handle.close();
    }
    this.metadata.set(path, metadata);
  }

  async replace(
    path: string,
    bytes: Uint8Array,
    metadata: AtlasPublicationObjectMetadata,
  ): Promise<void> {
    const target = join(this.root, path);
    await mkdir(join(target, '..'), { recursive: true });
    await writeFile(target, bytes);
    this.metadata.set(path, metadata);
  }

  async remove(path: string): Promise<void> {
    await rm(join(this.root, path), { force: true });
    this.metadata.delete(path);
  }

  async acquireLock(owner: string): Promise<AtlasPublicationLease> {
    await mkdir(this.root, { recursive: true });
    await writeFile(this.lockPath, owner, { flag: 'wx' });
    return {
      assertHeld: async () => undefined,
      release: async () => {
        await rm(this.lockPath, { force: true });
      },
    };
  }
}

class FailingMutableStorage implements AtlasPublicationStorage {
  readonly files = new Map<string, Uint8Array>();
  readonly metadata = new Map<string, AtlasPublicationObjectMetadata>();
  private failed = false;

  constructor(private readonly failingPath: string) {}

  async read(path: string): Promise<Uint8Array | undefined> {
    return this.files.get(path);
  }

  async inspect(
    path: string,
  ): Promise<AtlasPublicationObjectMetadata | undefined> {
    if (!this.files.has(path)) return undefined;
    return (
      this.metadata.get(path) ?? {
        cacheControl: 'no-cache',
        contentType: publicationContentType(path),
      }
    );
  }

  async create(
    path: string,
    bytes: Uint8Array,
    metadata: AtlasPublicationObjectMetadata,
  ): Promise<void> {
    this.files.set(path, bytes);
    this.metadata.set(path, metadata);
  }

  async replace(
    path: string,
    bytes: Uint8Array,
    metadata: AtlasPublicationObjectMetadata,
  ): Promise<void> {
    if (path === this.failingPath && !this.failed) {
      this.failed = true;
      throw new Error(`simulated write failure: ${path}`);
    }
    this.files.set(path, bytes);
    this.metadata.set(path, metadata);
  }

  async remove(path: string): Promise<void> {
    this.files.delete(path);
    this.metadata.delete(path);
  }

  async acquireLock(): Promise<AtlasPublicationLease> {
    return {
      assertHeld: async () => undefined,
      release: async () => undefined,
    };
  }

  seed(path: string, value: string): void {
    this.files.set(path, new TextEncoder().encode(value));
  }

  text(path: string): string | undefined {
    const bytes = this.files.get(path);
    return bytes ? new TextDecoder().decode(bytes) : undefined;
  }
}

class LeaseLossStorage extends DirectoryPublicationStorage {
  private assertions = 0;

  constructor(
    root: string,
    private readonly failAtAssertion: number,
  ) {
    super(root);
  }

  override async acquireLock(): Promise<AtlasPublicationLease> {
    return {
      assertHeld: async () => {
        this.assertions += 1;

        if (this.assertions >= this.failAtAssertion) {
          throw new Error('simulated lease loss');
        }
      },
      release: async () => undefined,
    };
  }
}

function isMissingFile(error: unknown): error is NodeJS.ErrnoException {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}
