import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import type { AtlasAppConfig } from '@atlas/schema';
import { createPromptDriver } from '../../cli/interaction/interaction.testkit.js';
import type { DevTarget } from '../types.js';
import { resolveDevTarget } from './target.js';

export class DevelopmentTargetDriver {
  private readonly appId = faker.string.uuid();
  private readonly firstHostId = faker.string.uuid();
  private readonly secondHostId = faker.string.uuid();
  private readonly origin = faker.internet.url({ appendSlash: false });
  private readonly firstPath = `/${faker.word.noun()}`;
  private readonly secondPath = `/${faker.word.noun()}`;
  private readonly originalFetch = globalThis.fetch;

  private config: AtlasAppConfig = {
    id: this.appId,
    framework: 'react',
  };
  private prompts = createPromptDriver([], false);
  private previewUrls: string[] = [];
  private result?: DevTarget;
  private error?: Error;

  given = {
    oneRoute: (): void => {
      this.config.routes = [{ hostId: this.firstHostId, path: this.firstPath }];
      this.previewUrls = [this.origin];
    },

    multipleRoutes: (interactive: boolean): void => {
      this.config.routes = [
        { hostId: this.firstHostId, path: this.firstPath },
        { hostId: this.firstHostId, path: this.secondPath },
      ];
      this.previewUrls = [this.origin];
      this.prompts = createPromptDriver([this.secondPath], interactive);
    },

    fullUrl: (): void => {
      this.config.routes = [
        { hostId: this.firstHostId, path: this.firstPath },
        { hostId: this.firstHostId, path: this.secondPath },
      ];
      this.previewUrls = [`${this.origin}${this.secondPath}?mode=dev`];
    },

    previews: (interactive: boolean): void => {
      this.previewUrls = [
        `${this.origin}${this.firstPath}`,
        `${this.origin}${this.secondPath}`,
      ];
      this.prompts = createPromptDriver([this.previewUrls[1]!], interactive);
      globalThis.fetch = jest.fn(async () =>
        Response.json({
          schemaVersion: 'v1',
          hostId: this.firstHostId,
          environment: 'production',
          artifactRegistryUrl: faker.internet.url({ appendSlash: false }),
        }),
      );
    },

    discoverableHost: (supported: boolean): void => {
      this.config.routes = [
        { hostId: this.firstHostId, path: this.firstPath },
        { hostId: this.secondHostId, path: this.secondPath },
      ];
      this.previewUrls = [`${this.origin}/${faker.word.noun()}`];

      const discoveredHostId = supported
        ? this.secondHostId
        : faker.string.uuid();

      globalThis.fetch = jest.fn(async () =>
        Response.json({
          schemaVersion: 'v1',
          hostId: discoveredHostId,
          environment: 'production',
          artifactRegistryUrl: faker.internet.url({ appendSlash: false }),
        }),
      );
    },
  };

  when = {
    resolve: async (): Promise<void> => {
      try {
        this.result = await resolveDevTarget({
          config: this.config,
          prompts: this.prompts,
          previewUrls: this.previewUrls,
        });
      } catch (error) {
        this.error = error as Error;
      } finally {
        this.restoreGlobals();
      }
    },
  };

  get = {
    result: (): DevTarget | undefined => this.result,
    errorMessage: (): string | undefined => this.error?.message,
    routeQuestion: (): string | undefined => this.prompts.questions[0],
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
    missingPreviewsError: (): string =>
      'package.json atlas.previews is required for atlas dev apps.',
    unsupportedHostError: (): string => `Host URL identifies`,
    selectedPreviewTarget: (): Pick<DevTarget, 'hostId' | 'hostUrl'> => ({
      hostId: this.firstHostId,
      hostUrl: this.previewUrls[1]!,
    }),
    previewQuestion: (): string | undefined => this.prompts.questions[0],
    multiplePreviewsError: (): string =>
      'Multiple Atlas previews configured. Run atlas dev interactively.',
  };

  private restoreGlobals(): void {
    globalThis.fetch = this.originalFetch;
  }
}
