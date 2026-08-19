import { createHash } from 'node:crypto';
import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import { createTestManifest } from '@atlas/testkit';
import {
  AtlasVerifyService,
  type AtlasVerificationReport,
  type AtlasVerifyOptions,
} from './verify.service.js';

type VerificationScenario =
  | 'healthy'
  | 'multiple-versions'
  | 'invalid-integrity'
  | 'duplicate-route'
  | 'missing-cors'
  | 'selected-asset-origin'
  | 'missing-shared-fallback'
  | 'incomplete-shared-metadata'
  | 'request-concurrency'
  | 'body-concurrency'
  | 'timeout'
  | 'zero-timeout'
  | 'infinite-timeout'
  | 'zero-cache-age';

export class VerifyServiceDriver {
  private readonly appId = faker.word.noun().toLowerCase();
  private readonly secondAppId = faker.word.noun().toLowerCase();
  private readonly hostId = faker.word.noun().toLowerCase();
  private readonly hostOrigin = faker.internet.url().replace(/\/$/, '');
  private readonly assetOrigin = faker.internet.url().replace(/\/$/, '');
  private maximumConcurrency = 0;
  private receivedSignal?: AbortSignal;
  private report?: AtlasVerificationReport;
  private options?: AtlasVerifyOptions;
  private service?: AtlasVerifyService;

  given = {
    deployment: (scenario: VerificationScenario): void => {
      const manifests = this.manifestsFor(scenario);
      const includeCors = scenario !== 'missing-cors';
      const cacheControl =
        scenario === 'zero-cache-age'
          ? 'public, max-age=0, immutable'
          : undefined;
      let fetcher = this.createDeploymentFetch(manifests, {
        assetCacheControl: cacheControl,
        includeCors,
      });
      let concurrency = 8;

      if (scenario === 'missing-shared-fallback') {
        const baseFetch = fetcher;
        fetcher = async (input, init) =>
          input.toString().endsWith('/shared/react.js')
            ? new Response('missing', { status: 404, statusText: 'Not Found' })
            : baseFetch(input, init);
      }

      if (scenario === 'incomplete-shared-metadata') {
        const baseFetch = fetcher;
        const invalidMetadata = JSON.stringify({
          exposes: [{ key: './entry', outFileName: 'entry.js' }],
          name: this.appId,
          shared: [{ packageName: 'react', outFileName: 'shared/react.js' }],
        });

        fetcher = async (input, init) =>
          input.toString().includes(`/${this.appId}/`) &&
          input.toString().endsWith('/remoteEntry.json')
            ? new Response(invalidMetadata, {
                headers: this.assetHeaders(true),
              })
            : baseFetch(input, init);
      }

      if (scenario === 'request-concurrency') {
        concurrency = 3;
        fetcher = this.withRequestConcurrency(fetcher, concurrency);
      }

      if (scenario === 'body-concurrency') {
        concurrency = 2;
        fetcher = this.withBodyConcurrency(fetcher, concurrency);
      }

      if (scenario === 'timeout') {
        fetcher = (_input, init) =>
          new Promise((_resolve, reject) => {
            const signal = init?.signal;

            if (!signal) {
              throw new Error(
                'Verify request did not receive an abort signal.',
              );
            }

            this.receivedSignal = signal;
            signal.addEventListener('abort', () => reject(signal.reason), {
              once: true,
            });
          });
      }

      const timeoutMs =
        scenario === 'timeout'
          ? 5
          : scenario === 'zero-timeout'
            ? 0
            : scenario === 'infinite-timeout'
              ? Number.POSITIVE_INFINITY
              : undefined;

      this.options = {
        hostOrigin: scenario === 'healthy' ? this.hostOrigin : undefined,
        runtimeUrl: `${this.hostOrigin}/atlas.runtime.json`,
        timeoutMs,
      };
      this.service = new AtlasVerifyService(fetcher, concurrency);
    },
  };

  when = {
    run: async (): Promise<void> => {
      if (!this.service || !this.options) {
        throw new Error('Deployment setup is required.');
      }

      if (this.options.timeoutMs === 5) {
        jest.useFakeTimers();

        try {
          const verification = this.service.run(this.options);

          await jest.advanceTimersByTimeAsync(5);

          this.report = await verification;
        } finally {
          jest.useRealTimers();
        }

        return;
      }

      this.report = await this.service.run(this.options);
    },
  };

  get = {
    duplicateRouteMessage: (): string | undefined =>
      this.report?.checks.find(
        (check) =>
          check.status === 'failure' && check.subject === 'route ownership',
      )?.message,
    hasFailure: (subject: string): boolean =>
      this.report?.checks.some(
        (check) =>
          check.status === 'failure' && check.subject.includes(subject),
      ) ?? false,
    hasWarning: (subject: string): boolean =>
      this.report?.checks.some(
        (check) =>
          check.status === 'warning' && check.subject.includes(subject),
      ) ?? false,
    healthyReport: () => ({
      failures: this.report?.failures,
      hostId: this.report?.hostId,
    }),
    healthyExpectation: () => ({ failures: 0, hostId: this.hostId }),
    maximumConcurrency: (): number => this.maximumConcurrency,
    requestAborted: (): boolean => this.receivedSignal?.aborted ?? false,
  };

  private manifestsFor(scenario: VerificationScenario): unknown[] {
    if (scenario === 'multiple-versions') {
      return [
        this.deploymentManifest(),
        this.deploymentManifest({ buildId: 'second', version: '2.0.0' }),
      ];
    }

    if (scenario === 'invalid-integrity') {
      return [this.deploymentManifest({ integrity: 'sha256-invalid' })];
    }

    if (scenario === 'duplicate-route') {
      return [
        this.deploymentManifest({
          id: this.appId,
          placements: [
            {
              hostId: this.hostId,
              id: faker.string.uuid(),
              kind: 'route',
              route: { path: '/orders', title: faker.commerce.department() },
            },
          ],
        }),
        this.deploymentManifest({
          id: this.secondAppId,
          placements: [
            {
              hostId: this.hostId,
              id: faker.string.uuid(),
              kind: 'route',
              route: { path: '/orders/', title: faker.commerce.department() },
            },
          ],
        }),
      ];
    }

    if (scenario === 'selected-asset-origin') {
      return [
        this.deploymentManifest({
          remoteEntryUrl: `${this.assetOrigin}/${this.appId}/remoteEntry.json`,
        }),
      ];
    }

    if (scenario === 'request-concurrency') {
      return Array.from({ length: 12 }, () => this.deploymentManifest());
    }

    if (scenario === 'body-concurrency') {
      return Array.from({ length: 8 }, () => this.deploymentManifest());
    }

    return [this.deploymentManifest()];
  }

  private deploymentManifest(overrides: Record<string, unknown> = {}) {
    return createTestManifest({
      id: this.appId,
      integrity: remoteIntegrity,
      remoteEntryUrl: `${this.assetOrigin}/${this.appId}/1/build/remoteEntry.json`,
      ...overrides,
    });
  }

  private createDeploymentFetch(
    manifests: unknown[],
    options: { includeCors: boolean; assetCacheControl?: string },
  ): typeof fetch {
    const jsonHeaders = {
      'cache-control': 'no-cache',
      'content-type': 'application/json',
    };
    const assetHeaders = this.assetHeaders(
      options.includeCors,
      options.assetCacheControl,
    );

    return async (input) => {
      const url = input.toString();

      if (url.endsWith('atlas.runtime.json')) {
        return Response.json(
          {
            catalogUrl: `${this.assetOrigin}/hosts/${this.hostId}/catalog.json`,
            hostId: this.hostId,
            resourcesRetryCount: 3,
            resourcesTimeoutMs: 15000,
            schemaVersion: '1',
          },
          { headers: jsonHeaders },
        );
      }

      if (url.endsWith('catalog.json')) {
        return Response.json(
          {
            apps: manifests,
            generatedAt: '2026-01-01T00:00:00.000Z',
            host: this.deploymentHostManifest(),
            hostId: this.hostId,
            revision: 'sha256:test',
            schemaVersion: '1',
          },
          {
            headers: {
              ...jsonHeaders,
              ...(options.includeCors
                ? { 'access-control-allow-origin': this.hostOrigin }
                : {}),
            },
          },
        );
      }

      if (
        url.includes(`/hosts/${this.hostId}/`) &&
        url.endsWith('remoteEntry.json')
      ) {
        return new Response(hostRemoteBytes, { headers: assetHeaders });
      }

      if (url.endsWith('remoteEntry.json')) {
        return new Response(remoteBytes, { headers: assetHeaders });
      }

      return new Response('export {};', {
        headers: { ...assetHeaders, 'content-type': 'text/javascript' },
      });
    };
  }

  private assetHeaders(
    includeCors: boolean,
    cacheControl = 'public, max-age=31536000, immutable',
  ) {
    return {
      ...(includeCors
        ? { 'access-control-allow-origin': this.hostOrigin }
        : {}),
      'cache-control': cacheControl,
      'content-type': 'application/json',
    };
  }

  private deploymentHostManifest() {
    return {
      buildId: faker.string.alphanumeric(12),
      channel: 'production',
      createdAt: '2026-01-01T00:00:00.000Z',
      exposes: { entry: './host' },
      framework: 'react',
      id: this.hostId,
      kind: 'host',
      name: faker.company.name(),
      remoteEntryUrl: `${this.assetOrigin}/hosts/${this.hostId}/1/build/remoteEntry.json`,
      requiredLoaderApiVersion: '^1.0.0',
      schemaVersion: '1',
      version: '1.0.0',
    };
  }

  private withRequestConcurrency(
    baseFetch: typeof fetch,
    limit: number,
  ): typeof fetch {
    let active = 0;
    let release = (): void => undefined;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });

    return async (...arguments_) => {
      const url = arguments_[0].toString();

      if (url.endsWith('atlas.runtime.json') || url.endsWith('catalog.json')) {
        return baseFetch(...arguments_);
      }

      active += 1;
      this.maximumConcurrency = Math.max(this.maximumConcurrency, active);

      if (active === limit) release();

      await barrier;

      try {
        return await baseFetch(...arguments_);
      } finally {
        active -= 1;
      }
    };
  }

  private withBodyConcurrency(
    baseFetch: typeof fetch,
    limit: number,
  ): typeof fetch {
    let active = 0;
    let release = (): void => undefined;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });

    return async (...arguments_) => {
      const response = await baseFetch(...arguments_);
      const readBody = response.arrayBuffer.bind(response);

      Object.defineProperty(response, 'arrayBuffer', {
        value: async () => {
          active += 1;
          this.maximumConcurrency = Math.max(this.maximumConcurrency, active);

          if (active === limit) release();

          await barrier;

          try {
            return await readBody();
          } finally {
            active -= 1;
          }
        },
      });

      return response;
    };
  }
}

const shared =
  '{"packageName":"react","outFileName":"shared/react.js","requiredVersion":"^19.0.0","singleton":true,"strictVersion":true,"version":"19.2.0"}';
const remoteBytes = new TextEncoder().encode(
  `{"name":"orders","exposes":[{"key":"./entry","outFileName":"entry.js"}],"shared":[${shared}]}`,
);
const hostRemoteBytes = new TextEncoder().encode(
  `{"name":"host","exposes":[{"key":"./host","outFileName":"host.js"}],"shared":[${shared}]}`,
);
const remoteIntegrity = `sha256-${createHash('sha256').update(remoteBytes).digest('base64')}`;
