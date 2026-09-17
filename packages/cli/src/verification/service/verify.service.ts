import {
  environmentManifestUrl,
  resolveAtlasRuntimeConfig,
  type AtlasHostCatalog,
  type AtlasHostRuntimeConfig,
} from '@atlas/schema';
import { loadHostDeployment } from '@atlas/runtime';
import { absoluteHttpUrl, errorMessage } from '../../shared/index.js';
import { verifyManifestAssets } from '../asset-checks/asset-checks.js';
import {
  isHostDeployment,
  verifyCatalog,
  withArtifactUrls,
} from '../catalog-checks/catalog-checks.js';
import {
  VerificationChecks,
  type AtlasVerificationReport,
} from '../checks/checks.js';
import {
  checkContentType,
  checkCors,
  checkImmutableCache,
  checkMutableCache,
} from '../header-checks/header-checks.js';
import type { AtlasVerifyOptions, VerificationContext } from '../types.js';
import { parseJson, VerifiedFetch } from '../verified-fetch/verified-fetch.js';

const DEFAULT_NETWORK_CONCURRENCY = 8;
const DEFAULT_NETWORK_TIMEOUT_MS = 10_000;

export class AtlasVerifyService {
  private readonly fetch: VerifiedFetch;

  constructor(
    fetchResource: typeof fetch = fetch,
    concurrency = DEFAULT_NETWORK_CONCURRENCY,
  ) {
    this.fetch = new VerifiedFetch(fetchResource, concurrency);
  }

  async run(options: AtlasVerifyOptions): Promise<AtlasVerificationReport> {
    const context = createContext(options);
    const runtime = await this.resolveRuntime(context);
    if (!runtime) return context.checks.report(context.hostUrl.href);

    const catalog = await this.fetchCatalog({ runtime, context });
    if (!catalog)
      return context.checks.report(context.hostUrl.href, runtime.hostId);

    verifyCatalog({ runtime, catalog, context });
    await Promise.all(
      [
        catalog.host,
        ...catalog.apps,
        ...(catalog.widgetProviders ?? []),
      ].flatMap((manifest) =>
        verifyManifestAssets({ manifest, context, fetch: this.fetch }),
      ),
    );

    return context.checks.report(context.hostUrl.href, runtime.hostId);
  }

  private async resolveRuntime(
    context: VerificationContext,
  ): Promise<AtlasHostRuntimeConfig | undefined> {
    const subject = 'runtime config';
    const url = new URL('/atlas.runtime.json', context.hostUrl);
    let config: unknown;
    const response = await this.fetch.checked({
      url,
      subject,
      context,
      consume: async (loaded) => {
        config = await parseJson({ response: loaded, subject, context });
      },
    });
    if (!response) return undefined;

    checkMutableCache({ checks: context.checks, response, subject });

    try {
      const runtime = resolveAtlasRuntimeConfig(config, context.hostUrl.href);
      context.checks.pass(
        subject,
        `Selected environment "${runtime.environment}" for host "${runtime.hostId}".`,
      );

      return runtime;
    } catch (error) {
      context.checks.fail(subject, errorMessage(error));

      return undefined;
    }
  }

  private async fetchCatalog({
    runtime,
    context,
  }: {
    runtime: AtlasHostRuntimeConfig;
    context: VerificationContext;
  }): Promise<AtlasHostCatalog | undefined> {
    const subject = 'active host manifest';
    const url = new URL(environmentManifestUrl(runtime));
    let value: unknown;
    const response = await this.fetch.checked({
      url,
      subject,
      context,
      consume: async (loaded) => {
        value = await parseJson({ response: loaded, subject, context });
      },
    });
    if (!response) return undefined;

    checkCors({
      checks: context.checks,
      response,
      url,
      subject,
      hostOrigin: context.hostOrigin,
    });
    checkMutableCache({ checks: context.checks, response, subject });

    if (!isHostDeployment(value)) {
      context.checks.fail(
        subject,
        'Expected schemaVersion v1 host-deployment with descriptor references.',
      );

      return undefined;
    }

    const deployment = withArtifactUrls({ deployment: value, runtime });
    const catalog = await loadHostDeployment({
      manifestUrl: url.href,
      expectedHostId: runtime.hostId,
      expectedEnvironment: runtime.environment,
      fetchBytes: (artifactUrl) =>
        this.fetchArtifactManifest({
          url: new URL(artifactUrl),
          deploymentManifestUrl: url,
          context,
        }),
    });
    context.checks.pass(
      subject,
      `Loaded ${deployment.host.path} and ${deployment.apps.length} selected app(s).`,
    );

    return catalog;
  }

  private async fetchArtifactManifest({
    url,
    deploymentManifestUrl,
    context,
  }: {
    url: URL;
    deploymentManifestUrl: URL;
    context: VerificationContext;
  }): Promise<ArrayBuffer> {
    const subject = 'artifact manifest';
    const response = await this.fetch.response({
      url,
      context,
      limitConcurrency: false,
    });
    if (!response.ok)
      throw new Error(`${url.href} returned HTTP ${response.status}.`);

    checkCors({
      checks: context.checks,
      response,
      url,
      subject,
      hostOrigin: context.hostOrigin,
    });
    checkContentType({
      checks: context.checks,
      response,
      subject,
      expected: 'json',
    });
    if (url.href !== deploymentManifestUrl.href)
      checkImmutableCache({
        checks: context.checks,
        response,
        subject,
        channel: 'production',
      });

    return response.arrayBuffer();
  }
}

function createContext(options: AtlasVerifyOptions): VerificationContext {
  const hostUrl = absoluteHttpUrl(options.hostUrl, '--host-url');
  const timeoutMs = options.timeoutMs ?? DEFAULT_NETWORK_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
    throw new Error('Verification timeout must be a positive finite number.');

  return {
    hostUrl,
    hostOrigin: hostUrl.origin,
    timeoutMs,
    checks: new VerificationChecks(),
  };
}
