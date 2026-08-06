import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import type { AtlasAppConfig } from '@atlas/schema';
import { CliArguments } from '../../cli/arguments.js';
import { createPromptDriver } from '../../cli/interaction/interaction.testkit.js';
import type { DevTarget } from '../types.js';
import { offerToSaveDevTarget, resolveDevTarget } from './target.js';

export class DevelopmentTargetDriver {
  private readonly appId = faker.string.uuid();
  private readonly firstHostId = faker.string.uuid();
  private readonly secondHostId = faker.string.uuid();
  private readonly origin = faker.internet.url({ appendSlash: false });
  private readonly firstPath = `/${faker.word.noun()}`;
  private readonly secondPath = `/${faker.word.noun()}`;
  private readonly originalFetch = globalThis.fetch;
  private readonly originalHostUrl = process.env.ATLAS_HOST_URL;

  private config: AtlasAppConfig = {
    id: this.appId,
    framework: 'react',
  };
  private args = new CliArguments([]);
  private prompts = createPromptDriver([], false);
  private root = '';
  private result?: DevTarget;
  private error?: Error;

  given = {
    oneRoute: (): void => {
      this.config.routes = [{ hostId: this.firstHostId, path: this.firstPath }];
      this.args = new CliArguments([`--host-url=${this.origin}`]);
    },

    multipleRoutes: (interactive: boolean): void => {
      this.config.routes = [
        { hostId: this.firstHostId, path: this.firstPath },
        { hostId: this.firstHostId, path: this.secondPath },
      ];
      this.args = new CliArguments([`--host-url=${this.origin}`]);
      this.prompts = createPromptDriver([this.secondPath], interactive);
    },

    fullUrl: (): void => {
      this.config.routes = [
        { hostId: this.firstHostId, path: this.firstPath },
        { hostId: this.firstHostId, path: this.secondPath },
      ];
      this.args = new CliArguments([
        `--host-url=${this.origin}${this.secondPath}?mode=dev`,
      ]);
    },

    missingUrl: (interactive: boolean): void => {
      delete process.env.ATLAS_HOST_URL;
      this.prompts = createPromptDriver([this.origin], interactive);
    },

    discoverableHost: (supported: boolean): void => {
      this.config.routes = [
        { hostId: this.firstHostId, path: this.firstPath },
        { hostId: this.secondHostId, path: this.secondPath },
      ];
      this.args = new CliArguments([
        `--host-url=${this.origin}/${faker.word.noun()}`,
      ]);

      const discoveredHostId = supported
        ? this.secondHostId
        : faker.string.uuid();

      globalThis.fetch = jest.fn(async () =>
        Response.json({
          schemaVersion: '1',
          hostId: discoveredHostId,
          catalogUrl: faker.internet.url(),
        }),
      );
    },

    promptedTargetToSave: async (): Promise<void> => {
      this.root = await mkdtemp(join(tmpdir(), 'atlas-target-'));
      this.prompts = createPromptDriver(['yes']);
      this.result = {
        hostId: this.firstHostId,
        hostUrl: `${this.origin}${this.firstPath}`,
        promptedForHostUrl: true,
      };
    },
  };

  when = {
    resolve: async (): Promise<void> => {
      try {
        this.result = await resolveDevTarget(
          this.config,
          this.args,
          this.prompts,
        );
      } catch (error) {
        this.error = error as Error;
      } finally {
        this.restoreGlobals();
      }
    },

    save: async (): Promise<void> => {
      await offerToSaveDevTarget(this.root, this.result!, this.prompts);
    },
  };

  get = {
    result: (): DevTarget | undefined => this.result,
    errorMessage: (): string | undefined => this.error?.message,
    routeQuestion: (): string | undefined => this.prompts.questions[0],
    savedHostUrl: async (): Promise<string> =>
      await readFile(join(this.root, '.env.local'), 'utf8'),
    firstTarget: (): Pick<DevTarget, 'hostId' | 'hostUrl'> => ({
      hostId: this.firstHostId,
      hostUrl: `${this.origin}${this.firstPath}`,
    }),
    secondTarget: (): Pick<DevTarget, 'hostId' | 'hostUrl'> => ({
      hostId: this.firstHostId,
      hostUrl: `${this.origin}${this.secondPath}`,
    }),
    fullTarget: (): Pick<DevTarget, 'hostId' | 'hostUrl'> => ({
      hostId: this.firstHostId,
      hostUrl: `${this.origin}${this.secondPath}?mode=dev`,
    }),
    discoveredHostId: (): string => this.secondHostId,
    missingUrlError: (): string =>
      'Host URL is required. Pass --host-url or set ATLAS_HOST_URL.',
    unsupportedHostError: (): string => `Host URL identifies`,
    savedEnv: (): string => `ATLAS_HOST_URL=${this.result!.hostUrl}\n`,
  };

  private restoreGlobals(): void {
    globalThis.fetch = this.originalFetch;

    if (this.originalHostUrl === undefined) {
      delete process.env.ATLAS_HOST_URL;
    } else {
      process.env.ATLAS_HOST_URL = this.originalHostUrl;
    }
  }
}
