import {
  assertAtlasManifest,
  assertAtlasHostManifest,
  type AtlasHostCatalog,
  type AtlasHostDeploymentManifest,
  type AtlasHostManifest,
  type AtlasHostRuntimeConfig,
  type AtlasManifest,
  environmentManifestUrl,
  placementTargetsHost,
  resolveAtlasRuntimeConfig,
} from '@atlas/schema';
import { loadHostDeployment } from '@atlas/runtime';
import {
  VerificationChecks,
  type AtlasVerificationReport,
} from '../checks/checks.js';
import { parseFederationMetadata } from '../federation-metadata/federation-metadata.js';
import {
  checkContentType,
  checkCors,
  checkImmutableCache,
  checkIntegrity,
  checkMutableCache,
  type ExpectedContentType,
} from '../header-checks/header-checks.js';
import { NetworkLimiter } from '../network-limiter/network-limiter.js';
import {
  isRetryableHttpStatus,
  withExponentialRetry,
  errorMessage,
  asRecord,
  nonEmptyString,
} from '../../shared/index.js';

export interface AtlasVerifyOptions {
  hostUrl: string;
  timeoutMs?: number;
}

const DEFAULT_NETWORK_CONCURRENCY = 8;
const DEFAULT_NETWORK_TIMEOUT_MS = 10_000;

interface VerificationContext {
  hostUrl: URL;
  hostOrigin: string;
  timeoutMs: number;
  checks: VerificationChecks;
}

interface AssetExpectation {
  url: string;
  subject: string;
  integrity?: string;
  contentType: ExpectedContentType;
  inspectFederationReferences?: boolean;
}

export class AtlasVerifyService {
  private readonly network: NetworkLimiter;

  constructor(
    private readonly fetchResource: typeof fetch = fetch,
    concurrency = DEFAULT_NETWORK_CONCURRENCY,
  ) {
    this.network = new NetworkLimiter(concurrency);
  }

  async run(options: AtlasVerifyOptions): Promise<AtlasVerificationReport> {
    const hostUrl = absoluteHttpUrl(options.hostUrl, '--host-url');
    const timeoutMs = options.timeoutMs ?? DEFAULT_NETWORK_TIMEOUT_MS;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
      throw new Error('Verification timeout must be a positive finite number.');
    const context: VerificationContext = {
      hostUrl,
      hostOrigin: hostUrl.origin,
      timeoutMs,
      checks: new VerificationChecks(),
    };

    const runtime = await this.resolveRuntime(context);
    if (!runtime) return context.checks.report(hostUrl.href);
    const catalog = await this.fetchCatalog(runtime, context);
    if (!catalog) return context.checks.report(hostUrl.href, runtime.hostId);

    this.verifyCatalog(runtime, catalog, context);
    await Promise.all(
      [
        catalog.host,
        ...catalog.apps,
        ...(catalog.widgetProviders ?? []),
      ].flatMap((manifest) => this.verifyManifestAssets(manifest, context)),
    );
    return context.checks.report(hostUrl.href, runtime.hostId);
  }

  private async resolveRuntime(
    context: VerificationContext,
  ): Promise<AtlasHostRuntimeConfig | undefined> {
    let config: unknown;
    const runtimeUrl = new URL('/atlas.runtime.json', context.hostUrl);
    const runtimeResponse = await this.fetch(
      runtimeUrl,
      'runtime config',
      context,
      async (loaded) => {
        config = await parseJson(loaded, 'runtime config', context);
      },
    );
    if (!runtimeResponse) return undefined;
    checkMutableCache({
      checks: context.checks,
      response: runtimeResponse,
      subject: 'runtime config',
    });
    try {
      const runtime = resolveAtlasRuntimeConfig(config, context.hostUrl.href);
      context.checks.pass(
        'runtime config',
        `Selected environment "${runtime.environment}" for host "${runtime.hostId}".`,
      );
      return runtime;
    } catch (error) {
      context.checks.fail('runtime config', errorMessage(error));
      return undefined;
    }
  }

  private async fetchCatalog(
    runtime: AtlasHostRuntimeConfig,
    context: VerificationContext,
  ): Promise<AtlasHostCatalog | undefined> {
    const deploymentManifestUrl = new URL(environmentManifestUrl(runtime));
    let value: unknown;
    const response = await this.fetch(
      deploymentManifestUrl,
      'active host manifest',
      context,
      async (loaded) => {
        value = await parseJson(loaded, 'active host manifest', context);
      },
    );
    if (!response) return undefined;
    checkCors({
      checks: context.checks,
      response,
      url: deploymentManifestUrl,
      subject: 'active host manifest',
      hostOrigin: context.hostOrigin,
    });
    checkMutableCache({
      checks: context.checks,
      response,
      subject: 'active host manifest',
    });
    if (!isHostDeployment(value)) {
      context.checks.fail(
        'active host manifest',
        'Expected schemaVersion v1 host-deployment with descriptor references.',
      );
      return undefined;
    }
    const deployment = withArtifactUrls(value, runtime);
    const catalog = await loadHostDeployment({
      manifestUrl: deploymentManifestUrl.href,
      expectedHostId: runtime.hostId,
      expectedEnvironment: runtime.environment,
      fetchBytes: async (url) => {
        const loaded = await this.fetchResponse(new URL(url), context, false);
        if (!loaded.ok)
          throw new Error(`${url} returned HTTP ${loaded.status}.`);
        checkCors({
          checks: context.checks,
          response: loaded,
          url: new URL(url),
          subject: 'artifact manifest',
          hostOrigin: context.hostOrigin,
        });
        checkContentType({
          checks: context.checks,
          response: loaded,
          subject: 'artifact manifest',
          expected: 'json',
        });
        if (url !== deploymentManifestUrl.href) {
          checkImmutableCache({
            checks: context.checks,
            response: loaded,
            subject: 'artifact manifest',
            channel: 'production',
          });
        }
        return loaded.arrayBuffer();
      },
    });
    context.checks.pass(
      'active host manifest',
      `Loaded ${deployment.host.path} and ${deployment.apps.length} selected app(s).`,
    );
    return catalog;
  }

  private verifyCatalog(
    runtime: AtlasHostRuntimeConfig,
    catalog: AtlasHostCatalog,
    context: VerificationContext,
  ): void {
    if (catalog.hostId === runtime.hostId)
      context.checks.pass('catalog host', `Matches "${runtime.hostId}".`);
    else
      context.checks.fail(
        'catalog host',
        `Expected "${runtime.hostId}", received "${catalog.hostId}".`,
      );

    try {
      assertAtlasHostManifest(catalog.host);
      context.checks.pass(
        `${catalog.host.id} host manifest`,
        `${catalog.host.version} (${catalog.host.buildId}) is valid.`,
      );
    } catch (error) {
      context.checks.fail(
        `${catalog.host.id || 'unknown'} host manifest`,
        errorMessage(error),
      );
    }

    const ids = new Set<string>();
    const selectedApps = [...catalog.apps, ...(catalog.widgetProviders ?? [])];
    for (const manifest of selectedApps) {
      try {
        assertAtlasManifest(manifest);
        context.checks.pass(
          `${manifest.id} manifest`,
          `${manifest.version} (${manifest.buildId}) is valid.`,
        );
      } catch (error) {
        context.checks.fail(
          `${manifest.id || 'unknown'} manifest`,
          errorMessage(error),
        );
      }
      if (ids.has(manifest.id))
        context.checks.fail(
          'catalog versions',
          `app "${manifest.id}" is selected more than once.`,
        );
      ids.add(manifest.id);
    }
    if (ids.size === selectedApps.length)
      context.checks.pass(
        'catalog versions',
        'Exactly one version is selected per app.',
      );
    this.verifyRouteOwnership(catalog, context);
  }

  private verifyRouteOwnership(
    catalog: AtlasHostCatalog,
    context: VerificationContext,
  ): void {
    const owners = new Map<string, string>();
    const conflicts: string[] = [];
    for (const manifest of catalog.apps) {
      for (const placement of manifest.placements) {
        if (
          !placementTargetsHost(placement, catalog.hostId) ||
          placement.kind !== 'route' ||
          !placement.route
        )
          continue;
        const path = normalizeRoutePath(placement.route.path);
        const owner = owners.get(path);
        if (owner)
          conflicts.push(
            `hostId "${catalog.hostId}" path "${path}" is declared by "${owner}" and "${manifest.id}"`,
          );
        owners.set(path, manifest.id);
      }
    }
    if (conflicts.length > 0)
      context.checks.fail(
        'route ownership',
        `Duplicate routes: ${conflicts.join(', ')}. In atlas.config.ts routes, each hostId can use a path only once. Use a different path or hostId.`,
      );
    else
      context.checks.pass('route ownership', 'Every exact path has one owner.');
  }

  private verifyManifestAssets(
    manifest: AtlasManifest | AtlasHostManifest,
    context: VerificationContext,
  ): Promise<void>[] {
    const assets: AssetExpectation[] = [
      {
        url: manifest.remoteEntryUrl,
        subject: `${manifest.id} remote entry`,
        integrity: manifest.integrity,
        contentType: 'json',
        inspectFederationReferences: true,
      },
      ...(manifest.styles ?? []).map((style, index): AssetExpectation => ({
        url: style.href,
        subject: `${manifest.id} stylesheet ${index + 1}`,
        integrity: style.integrity,
        contentType: 'css',
      })),
    ];
    return assets.map((asset) => this.verifyAsset(asset, manifest, context));
  }

  private async verifyAsset(
    asset: AssetExpectation,
    manifest: AtlasManifest | AtlasHostManifest,
    context: VerificationContext,
  ): Promise<void> {
    const url = new URL(asset.url, context.hostUrl);
    context.checks.pass(`${asset.subject} URL`, url.href);
    let bytes: Uint8Array | undefined;
    const response = await this.fetch(
      url,
      asset.subject,
      context,
      async (loaded) => {
        bytes = new Uint8Array(await loaded.arrayBuffer());
      },
    );
    if (!response) return;
    checkCors({
      checks: context.checks,
      response,
      url,
      subject: asset.subject,
      hostOrigin: context.hostOrigin,
    });
    checkContentType({
      checks: context.checks,
      response,
      subject: asset.subject,
      expected: asset.contentType,
    });
    checkImmutableCache({
      checks: context.checks,
      response,
      subject: asset.subject,
      channel: manifest.channel,
    });
    if (!bytes) return;
    checkIntegrity({
      checks: context.checks,
      bytes,
      subject: asset.subject,
      integrity: asset.integrity,
      channel: manifest.channel,
    });
    if (asset.inspectFederationReferences)
      await this.verifyFederationReferences(bytes, url, manifest, context);
  }

  private async verifyFederationReferences(
    bytes: Uint8Array,
    remoteEntryUrl: URL,
    manifest: AtlasManifest | AtlasHostManifest,
    context: VerificationContext,
  ): Promise<void> {
    let metadata;
    try {
      metadata = parseFederationMetadata(bytes);
    } catch (error) {
      context.checks.fail(
        `${manifest.id} federation metadata`,
        errorMessage(error),
      );

      return;
    }
    const exposedKeys = new Set(metadata.exposes.map((entry) => entry.key));
    const requiredExposes = new Set([
      ...Object.values(manifest.exposes),
      ...(manifest.kind === 'app'
        ? (manifest.exportedWidgets ?? []).map((component) => component.expose)
        : []),
    ]);
    const missingExposes = [...requiredExposes].filter(
      (expose) => !exposedKeys.has(expose),
    );
    if (missingExposes.length > 0)
      context.checks.fail(
        `${manifest.id} federation exposes`,
        `Missing: ${missingExposes.join(', ')}.`,
      );
    else
      context.checks.pass(
        `${manifest.id} federation exposes`,
        'Manifest exposes are present in remote metadata.',
      );

    const references = [
      ...metadata.exposes.map((entry) => ({
        subject: `${manifest.id} expose ${entry.key}`,
        outFileName: entry.outFileName,
      })),
      ...metadata.shared.map((entry) => ({
        subject: `${manifest.id} shared ${entry.packageName}`,
        outFileName: entry.outFileName,
      })),
    ];
    await Promise.all(
      references.map(async (reference) => {
        const url = new URL(reference.outFileName, remoteEntryUrl);
        const subject = reference.subject;
        const response = await this.fetch(url, subject, context);
        if (!response) return;
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
          expected: 'javascript',
        });
        checkImmutableCache({
          checks: context.checks,
          response,
          subject,
          channel: manifest.channel,
        });
      }),
    );
  }

  private async fetch(
    url: URL,
    subject: string,
    context: VerificationContext,
    consume?: (response: Response) => Promise<void>,
  ): Promise<Response | undefined> {
    try {
      const response = await this.fetchResponse(url, context, true, consume);
      if (!response.ok) {
        context.checks.fail(
          subject,
          `${url.href} returned ${response.status} ${response.statusText}.`,
        );
        return undefined;
      }
      return response;
    } catch (error) {
      context.checks.fail(
        subject,
        `${url.href} could not be fetched: ${errorMessage(error)}`,
      );
      return undefined;
    }
  }

  private async fetchResponse(
    url: URL,
    context: VerificationContext,
    limitConcurrency = true,
    consume?: (response: Response) => Promise<void>,
  ): Promise<Response> {
    return withExponentialRetry(async () => {
      const request = async () => {
        const response = await this.fetchResource(url, {
          headers: { Origin: context.hostOrigin },
          cache: 'no-store',
          signal: AbortSignal.timeout(context.timeoutMs),
        });
        if (isRetryableHttpStatus(response.status)) {
          throw Object.assign(
            new Error(`${url.href} returned HTTP ${response.status}.`),
            { status: response.status },
          );
        }
        if (response.ok) await consume?.(response);
        return response;
      };
      const response = limitConcurrency
        ? await this.network.run(request)
        : await request();
      return response;
    });
  }
}

async function parseJson(
  response: Response,
  subject: string,
  context: VerificationContext,
): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    context.checks.fail(subject, `Invalid JSON: ${errorMessage(error)}`);
    return undefined;
  }
}

function isHostDeployment(
  value: unknown,
): value is AtlasHostDeploymentManifest {
  const record = asRecord(value);
  return (
    record?.schemaVersion === 'v1' &&
    record.kind === 'host-deployment' &&
    nonEmptyString(record.hostId) &&
    nonEmptyString(record.environment) &&
    nonEmptyString(record.deploymentRevision) &&
    asRecord(record.host) !== undefined &&
    Array.isArray(record.apps)
  );
}

function withArtifactUrls(
  deployment: AtlasHostDeploymentManifest,
  runtime: AtlasHostRuntimeConfig,
): AtlasHostDeploymentManifest {
  const reference = (descriptor: AtlasHostDeploymentManifest['host']) => ({
    ...descriptor,
    url: new URL(descriptor.path, `${runtime.artifactRegistryUrl}/`).href,
  });
  return {
    ...deployment,
    host: reference(deployment.host),
    apps: deployment.apps.map(reference),
    ...(deployment.widgetProviders
      ? { widgetProviders: deployment.widgetProviders.map(reference) }
      : {}),
  };
}

function absoluteHttpUrl(value: string, flag: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${flag} must be an absolute HTTP(S) URL.`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    throw new Error(`${flag} must be an absolute HTTP(S) URL.`);
  return url;
}

function normalizeRoutePath(path: string): string {
  return path === '/' ? path : path.replace(/\/+$/, '');
}
