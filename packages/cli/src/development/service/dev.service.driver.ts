import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import type { AtlasHostManifest } from '@atlas/schema';
import { createTestManifest } from '@atlas/testkit';
import { CliArguments } from '../../cli/arguments.js';
import {
  createTestWorkspace,
  testTypeScriptConfig,
} from '../../test-utils/build.testkit.js';
import type { AtlasWorkspace } from '../../workspace/service/workspace.js';
import type { AtlasDevBuildService } from '../types.js';
import { AtlasDevService } from './dev.service.js';

type DevelopmentScenario = 'host-prepare' | 'app-prepare';

export class DevServiceDriver {
  private readonly appId = faker.string.uuid();
  private readonly hostId = faker.string.uuid();
  private readonly projectName = faker.word.noun().toLowerCase();
  private readonly port = faker.number.int({ min: 4500, max: 5999 });
  private readonly hostUrl = faker.internet.url();
  private readonly spawn = jest.fn<AtlasWorkspace['spawn']>(() => {
    throw new Error('Prepare-only development must not spawn.');
  });
  private root = '';
  private projectRoot = '';
  private service?: AtlasDevService;
  private originalFetch?: typeof globalThis.fetch;
  private observation?: unknown;

  given = {
    project: async (scenario: DevelopmentScenario): Promise<void> => {
      this.root = await mkdtemp(join(tmpdir(), 'atlas-dev-service-'));
      this.projectRoot = join(this.root, this.projectName);

      await mkdir(this.projectRoot, { recursive: true });
      await writeFile(
        join(this.projectRoot, 'package.json'),
        JSON.stringify({
          name: this.projectName,
          type: 'module',
          version: '1.0.0',
        }),
      );
      await writeFile(
        join(this.projectRoot, 'tsconfig.json'),
        JSON.stringify(testTypeScriptConfig()),
      );
      await writeFile(
        join(this.projectRoot, 'atlas.config.ts'),
        this.configSource(scenario),
      );

      const project = {
        id: this.projectName,
        outputPaths: [],
        packageName: this.projectName,
        root: this.projectRoot,
        version: '1.0.0',
      };
      const workspace = createTestWorkspace({
        findProject: async () => project,
        root: this.root,
        spawn: this.spawn,
      });
      const arguments_ =
        scenario === 'host-prepare'
          ? ['dev', this.projectName, '--prepare-only']
          : [
              'dev',
              this.projectName,
              `--host-url=${this.hostUrl}`,
              `--port=${this.port}`,
              '--prepare-only',
            ];
      const builds = this.builds(scenario);

      if (scenario === 'app-prepare') {
        this.originalFetch = globalThis.fetch;
        globalThis.fetch = jest.fn<typeof globalThis.fetch>().mockResolvedValue(
          Response.json({
            catalogUrl: faker.internet.url(),
            hostId: this.hostId,
            schemaVersion: '1',
          }),
        );
      }

      this.service = new AtlasDevService(
        workspace,
        new CliArguments(arguments_),
        builds,
      );
    },
  };

  when = {
    prepare: async (): Promise<void> => {
      if (!this.service) throw new Error('Development setup is required.');

      try {
        await this.service.run(this.projectName);
      } finally {
        if (this.originalFetch) globalThis.fetch = this.originalFetch;
      }

      const document = JSON.parse(
        await readFile(
          join(this.projectRoot, '.atlas', 'local-overrides.json'),
          'utf8',
        ),
      );

      this.observation = {
        appId: document.overrides[0]?.appId,
        hostId: document.hostId,
        hostOverrideId: document.hostOverride?.id,
        remoteEntryUrl: document.overrides[0]?.manifest.remoteEntryUrl,
        spawnCount: this.spawn.mock.calls.length,
      };
    },
  };

  get = {
    appPreparation: () => ({
      appId: this.appId,
      hostId: this.hostId,
      hostOverrideId: undefined,
      remoteEntryUrl: `http://localhost:${this.port}/remoteEntry.json`,
      spawnCount: 0,
    }),
    hostPreparation: () => ({
      appId: undefined,
      hostId: this.hostId,
      hostOverrideId: this.hostId,
      remoteEntryUrl: undefined,
      spawnCount: 0,
    }),
    observation: (): unknown => this.observation,
  };

  private configSource(scenario: DevelopmentScenario): string {
    return scenario === 'host-prepare'
      ? `export default { type: "host", id: "${this.hostId}", framework: "react" };\n`
      : `export default { id: "${this.appId}", name: "${faker.company.name()}", framework: "react", routes: [{ hostId: "*", path: "/orders" }] };\n`;
  }

  private builds(scenario: DevelopmentScenario): AtlasDevBuildService {
    if (scenario === 'host-prepare') {
      const manifest: AtlasHostManifest = {
        buildId: 'local',
        channel: 'local',
        createdAt: faker.date.past().toISOString(),
        exposes: { entry: './host' },
        framework: 'react',
        id: this.hostId,
        kind: 'host',
        name: faker.company.name(),
        remoteEntryUrl: `http://localhost:4300/remoteEntry.json`,
        requiredLoaderApiVersion: '^1.0.0',
        schemaVersion: '1',
        version: '1.0.0',
      };

      return {
        buildLocalHostManifest: jest
          .fn<NonNullable<AtlasDevBuildService['buildLocalHostManifest']>>()
          .mockResolvedValue(manifest),
        buildManifest: jest.fn<AtlasDevBuildService['buildManifest']>(),
        loadConfig: jest
          .fn<AtlasDevBuildService['loadConfig']>()
          .mockResolvedValue({
            framework: 'react',
            id: this.hostId,
            type: 'host',
          }),
      };
    }

    return {
      buildManifest: jest
        .fn<AtlasDevBuildService['buildManifest']>()
        .mockResolvedValue(
          createTestManifest({
            buildId: 'local',
            channel: 'local',
            id: this.appId,
            remoteEntryUrl: `http://localhost:${this.port}/remoteEntry.json`,
          }),
        ),
      loadConfig: jest
        .fn<AtlasDevBuildService['loadConfig']>()
        .mockResolvedValue({
          framework: 'react',
          id: this.appId,
          name: faker.company.name(),
          routes: [
            { hostId: '*', path: '/orders', title: faker.lorem.words() },
          ],
        }),
    };
  }
}
