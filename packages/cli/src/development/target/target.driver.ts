import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import type { AtlasHostConfig } from '@atlas/schema';
import { aHostRuntimeConfig } from '@atlas/testkit';
import { aHostConfig, anAppConfig } from '@atlas/testkit/internal';
import { createPromptDriver } from '../../shared/interaction/interaction.testkit.js';
import type { DevTarget } from '../types.js';
import { resolveDevTarget, resolveHostDevTarget } from './target.js';

export class DevelopmentTargetDriver {
  private readonly appId = faker.string.uuid();
  private readonly firstHostId = faker.string.uuid();
  private readonly secondHostId = faker.string.uuid();
  private readonly origin = faker.internet.url({ appendSlash: false });
  private readonly localPreviewUrl = 'http://localhost:4200';
  private readonly firstPath = `/${faker.word.noun()}`;
  private readonly secondPath = `/${faker.word.noun()}`;
  private readonly originalFetch = globalThis.fetch;

  private config = anAppConfig({ id: this.appId });
  private hostConfig?: AtlasHostConfig;
  private prompts = createPromptDriver([], false);
  private previewUrls: string[] = [];
  private result?: DevTarget;
  private error?: Error;

  given = {
    oneRoute: () => {
      this.config.routes = [{ hostId: this.firstHostId, path: this.firstPath }];
      this.previewUrls = [this.origin];
    },

    multipleRoutes: (interactive: boolean) => {
      this.config.routes = [
        { hostId: this.firstHostId, path: this.firstPath },
        { hostId: this.firstHostId, path: this.secondPath },
      ];
      this.previewUrls = [this.origin];
      this.prompts = createPromptDriver([this.secondPath], interactive);
    },

    fullUrl: () => {
      this.config.routes = [
        { hostId: this.firstHostId, path: this.firstPath },
        { hostId: this.firstHostId, path: this.secondPath },
      ];
      this.previewUrls = [`${this.origin}${this.secondPath}?mode=dev`];
    },

    previews: (interactive: boolean) => {
      this.previewUrls = [
        `${this.origin}${this.firstPath}`,
        `${this.origin}${this.secondPath}`,
      ];
      this.prompts = createPromptDriver([this.previewUrls[1]!], interactive);
      globalThis.fetch = jest.fn(async () =>
        Response.json(aHostRuntimeConfig({ hostId: this.firstHostId })),
      );
    },

    discoverableHost: (supported: boolean) => {
      this.config.routes = [
        { hostId: this.firstHostId, path: this.firstPath },
        { hostId: this.secondHostId, path: this.secondPath },
      ];
      this.previewUrls = [`${this.origin}/${faker.word.noun()}`];

      const discoveredHostId = supported
        ? this.secondHostId
        : faker.string.uuid();

      globalThis.fetch = jest.fn(async () =>
        Response.json(aHostRuntimeConfig({ hostId: discoveredHostId })),
      );
    },

    hostPreview: (
      previewKind: 'default' | 'deployed' | 'local',
      matching = true,
    ) => {
      this.hostConfig = aHostConfig({ id: this.appId });
      this.previewUrls =
        previewKind === 'default'
          ? []
          : [previewKind === 'local' ? this.localPreviewUrl : this.origin];
      globalThis.fetch = jest.fn(async () =>
        Response.json(
          aHostRuntimeConfig({
            hostId: matching ? this.appId : this.firstHostId,
          }),
        ),
      );
    },
  };

  when = {
    resolve: async () => {
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
    resolveHost: async () => {
      try {
        if (!this.hostConfig) throw new Error('Host setup is required.');
        this.result = await resolveHostDevTarget({
          config: this.hostConfig,
          localPreviewUrl: this.localPreviewUrl,
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
    result: () => this.result,
    extractErrorMessage: () => this.error?.message,
    routeQuestion: () => this.prompts.questions[0],
    firstTarget: () => ({
      hostId: this.firstHostId,
      hostUrl: `${this.origin}${this.firstPath}`,
    }),
    secondTarget: () => ({
      hostId: this.firstHostId,
      hostUrl: `${this.origin}${this.secondPath}`,
    }),
    fullTarget: () => ({
      hostId: this.firstHostId,
      hostUrl: `${this.origin}${this.secondPath}?mode=dev`,
    }),
    discoveredHostId: () => this.secondHostId,
    missingPreviewsError: () =>
      'package.json atlas.previews is required for atlas dev apps.',
    unsupportedHostError: () => `Host URL identifies`,
    selectedPreviewTarget: () => ({
      hostId: this.firstHostId,
      hostUrl: this.previewUrls[1]!,
    }),
    previewQuestion: () => this.prompts.questions[0],
    multiplePreviewsError: () =>
      'Multiple Atlas previews configured. Run atlas dev interactively.',
    hostPreview: () => this.result,
    localPreviewUrl: () => this.localPreviewUrl,
  };

  private restoreGlobals(): void {
    globalThis.fetch = this.originalFetch;
  }
}
