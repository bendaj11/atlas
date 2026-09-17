import type { AtlasPublicationListedObject } from '../publication-storage/publication-storage.js';
import {
  transportError,
  unknownMutationOutcome,
} from './artifactory-errors.js';
import { encodePath, validateBaseUrl } from './artifactory-paths.js';
import {
  discardResponse,
  downloadResponse,
  lastModified,
  readJson,
  requireMutationStatus,
  requireProperty,
  requireRecord,
  requireSize,
  requireStatus,
} from './artifactory-responses.js';
import type {
  ArtifactoryConnectionOptions,
  ArtifactoryDependencies,
  ArtifactoryFileInfo,
  ArtifactoryObjectMetadata,
  ArtifactoryResponse,
  ArtifactUpload,
} from './types.js';

const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;
const SHA256_PATTERN = /^[a-f\d]{64}$/i;
const HEADER_UNSAFE_PATTERN = /[\r\n\0]/;

export class ArtifactoryClient {
  private readonly requestFetch: typeof fetch;
  private readonly timeoutSignal: (milliseconds: number) => AbortSignal;
  private readonly repositoryUrl: string;
  private readonly storageUrl: string;
  private readonly publicUrl: string;
  private readonly authorization: string;
  private readonly requestTimeoutMs: number;

  constructor(
    options: ArtifactoryConnectionOptions,
    dependencies: ArtifactoryDependencies = {},
  ) {
    const baseUrl = validateBaseUrl(options.url);
    const repository = encodePath(options.repository);
    if (options.repository.includes('/'))
      throw new Error('Artifactory repository must be one path segment.');

    const prefix = encodePath(options.prefix);
    if (!options.accessToken || /\s/.test(options.accessToken))
      throw new Error(
        'Artifactory requires a nonempty access token without whitespace.',
      );

    this.repositoryUrl = `${baseUrl}/${repository}/${prefix}`;
    this.storageUrl = `${baseUrl}/api/storage/${repository}/${prefix}`;
    this.publicUrl = validateBaseUrl(options.publicUrl);
    this.authorization = `Bearer ${options.accessToken}`;
    this.requestTimeoutMs =
      options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    if (
      !Number.isSafeInteger(this.requestTimeoutMs) ||
      this.requestTimeoutMs <= 0
    )
      throw new Error(
        'Artifactory request timeout must be a positive integer.',
      );

    this.requestFetch = dependencies.fetch ?? fetch;
    this.timeoutSignal = dependencies.timeoutSignal ?? AbortSignal.timeout;
  }

  async readStream(
    path: string,
  ): Promise<AsyncIterable<Uint8Array> | undefined> {
    const { response, signal } = await this.request(
      `${this.repositoryUrl}/${encodePath(path)}`,
      { headers: this.authenticatedHeaders() },
    );

    return downloadResponse({ response, signal });
  }

  async readPublicStream(
    path: string,
  ): Promise<AsyncIterable<Uint8Array> | undefined> {
    const { response, signal } = await this.request(
      `${this.publicUrl}/${encodePath(path)}`,
      { headers: { 'Cache-Control': 'no-cache' }, credentials: 'omit' },
    );

    return downloadResponse({ response, signal });
  }

  async fileInfo(path: string): Promise<ArtifactoryFileInfo | undefined> {
    const { response, signal } = await this.request(
      `${this.storageUrl}/${encodePath(path)}`,
      { headers: this.authenticatedHeaders() },
    );
    if (response.status === 404) {
      await discardResponse(response);

      return undefined;
    }

    await requireStatus({ response, accepted: [200] });
    const info = requireRecord(await readJson({ response, signal }));
    const checksums = requireRecord(info.checksums);
    if (
      'children' in info ||
      typeof checksums.sha256 !== 'string' ||
      !SHA256_PATTERN.test(checksums.sha256)
    )
      throw new Error(
        'Artifactory file information requires a file with a SHA-256 checksum.',
      );

    return {
      size: requireSize(info.size),
      versionToken: checksums.sha256.toLowerCase(),
    };
  }

  async metadata(path: string): Promise<ArtifactoryObjectMetadata> {
    const { response, signal } = await this.request(
      `${this.storageUrl}/${encodePath(path)}?properties=artifactory.content-type,atlas.cache-control`,
      { headers: this.authenticatedHeaders() },
    );
    await requireStatus({ response, accepted: [200] });

    const properties = requireRecord(
      requireRecord(await readJson({ response, signal })).properties,
    );

    return {
      contentType: requireProperty(properties['artifactory.content-type']),
      cacheControl: requireProperty(properties['atlas.cache-control']),
    };
  }

  async deliveryMetadata(path: string): Promise<ArtifactoryObjectMetadata> {
    const { response } = await this.request(
      `${this.publicUrl}/${encodePath(path)}`,
      {
        method: 'HEAD',
        headers: { 'Cache-Control': 'no-cache' },
        credentials: 'omit',
      },
    );
    await requireStatus({ response, accepted: [200] });

    const cacheControl = response.headers.get('cache-control')?.trim();
    const contentType = response.headers.get('content-type')?.trim();
    if (!cacheControl || !contentType)
      throw new Error(
        'Artifactory delivery requires actual Cache-Control and Content-Type response headers.',
      );

    return { cacheControl, contentType };
  }

  async list(prefix: string): Promise<AtlasPublicationListedObject[]> {
    const normalizedPrefix = prefix.replace(/\/$/, '');
    if (prefix && !normalizedPrefix)
      throw new Error('Artifactory listing prefix must be relative.');

    const suffix = normalizedPrefix ? `/${encodePath(normalizedPrefix)}` : '';
    const { response, signal } = await this.request(
      `${this.storageUrl}${suffix}?list&deep=1&listFolders=0`,
      { headers: this.authenticatedHeaders() },
    );
    if (response.status === 404) {
      await discardResponse(response);

      return [];
    }

    await requireStatus({ response, accepted: [200] });
    const listing = requireRecord(await readJson({ response, signal }));
    if (!Array.isArray(listing.files))
      throw new Error('Artifactory returned an invalid file listing.');

    const paths = new Set<string>();

    return listing.files.map((file: unknown) => {
      const item = requireRecord(file);
      if (
        typeof item.uri !== 'string' ||
        !item.uri.startsWith('/') ||
        item.folder !== false
      )
        throw new Error('Artifactory returned an invalid file listing entry.');

      const relativePath = item.uri.slice(1);
      encodePath(relativePath);
      const path = normalizedPrefix
        ? `${normalizedPrefix}/${relativePath}`
        : relativePath;
      if (paths.has(path))
        throw new Error('Artifactory returned duplicate file listing entries.');
      paths.add(path);

      return {
        path,
        size: requireSize(item.size),
        ...lastModified(item.lastModified),
      };
    });
  }

  async upload(input: ArtifactUpload): Promise<void> {
    if (
      !SHA256_PATTERN.test(input.sha256) ||
      !input.contentType ||
      !input.cacheControl ||
      HEADER_UNSAFE_PATTERN.test(input.contentType) ||
      HEADER_UNSAFE_PATTERN.test(input.cacheControl)
    )
      throw new Error(
        'Artifactory upload requires a valid SHA-256 checksum, Content-Type, and Cache-Control.',
      );

    const path = encodePath(input.path);
    const contentType = encodeURIComponent(input.contentType);
    const cacheControl = encodeURIComponent(input.cacheControl);
    const { response } = await this.request(
      `${this.repositoryUrl}/${path};artifactory.content-type=${contentType};atlas.cache-control=${cacheControl}`,
      {
        method: 'PUT',
        headers: {
          ...this.authenticatedHeaders(),
          'Content-Type': input.contentType,
          'X-Checksum-Sha256': input.sha256,
        },
        body: new Uint8Array(input.bytes).buffer,
      },
    );

    await requireMutationStatus({ response, accepted: [200, 201] });
    await discardResponse(response);
  }

  async remove(path: string): Promise<void> {
    const { response } = await this.request(
      `${this.repositoryUrl}/${encodePath(path)}`,
      { method: 'DELETE', headers: this.authenticatedHeaders() },
    );

    await requireMutationStatus({ response, accepted: [204, 404] });
    await discardResponse(response);
  }

  private authenticatedHeaders(): Record<string, string> {
    return { Authorization: this.authorization };
  }

  private async request(
    url: string,
    options: RequestInit,
  ): Promise<ArtifactoryResponse> {
    const signal = this.timeoutSignal(this.requestTimeoutMs);

    try {
      const response = await this.requestFetch(url, {
        ...options,
        redirect: 'error',
        cache: 'no-store',
        signal,
      });

      return { response, signal };
    } catch (error) {
      if (options.method === 'PUT' || options.method === 'DELETE')
        throw unknownMutationOutcome();

      throw transportError({
        message:
          'Artifactory request failed; check connectivity, TLS trust, and request timeout.',
        error,
        signal,
      });
    }
  }
}
