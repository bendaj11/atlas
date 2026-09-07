import type { AtlasPublicationListedObject } from '../publication-storage/publication-storage.js';

export interface ArtifactoryConnectionOptions {
  readonly url: string;
  readonly repository: string;
  readonly prefix: string;
  readonly accessToken: string;
  readonly publicUrl: string;
  readonly requestTimeoutMs?: number;
}

interface ArtifactoryDependencies {
  readonly fetch?: typeof fetch;
  readonly timeoutSignal?: (milliseconds: number) => AbortSignal;
}

interface ArtifactUpload {
  readonly path: string;
  readonly bytes: Uint8Array;
  readonly contentType: string;
  readonly cacheControl: string;
  readonly sha256: string;
}

interface ArtifactoryResponse {
  readonly response: Response;
  readonly signal: AbortSignal;
}

const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;
const SHA256_PATTERN = /^[a-f\d]{64}$/i;
const TRANSIENT_NETWORK_CODES = new Set([
  'ECONNABORTED',
  'ECONNRESET',
  'EAI_AGAIN',
  'ENETUNREACH',
  'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
]);
const TRANSPORT_TIMEOUT_CODES = new Set([
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
]);

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
    if (options.repository.includes('/')) {
      throw new Error('Artifactory repository must be one path segment.');
    }
    const prefix = encodePath(options.prefix);
    if (!options.accessToken || /\s/.test(options.accessToken)) {
      throw new Error(
        'Artifactory requires a nonempty access token without whitespace.',
      );
    }

    this.repositoryUrl = `${baseUrl}/${repository}/${prefix}`;
    this.storageUrl = `${baseUrl}/api/storage/${repository}/${prefix}`;
    this.publicUrl = validateBaseUrl(options.publicUrl);
    this.authorization = `Bearer ${options.accessToken}`;
    this.requestTimeoutMs =
      options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    if (
      !Number.isSafeInteger(this.requestTimeoutMs) ||
      this.requestTimeoutMs <= 0
    ) {
      throw new Error(
        'Artifactory request timeout must be a positive integer.',
      );
    }
    this.requestFetch = dependencies.fetch ?? fetch;
    this.timeoutSignal = dependencies.timeoutSignal ?? AbortSignal.timeout;
  }

  async readStream(
    path: string,
  ): Promise<AsyncIterable<Uint8Array> | undefined> {
    const { response, signal } = await this.request(
      `${this.repositoryUrl}/${encodePath(path)}`,
      {
        headers: this.authenticatedHeaders(),
      },
    );
    return downloadResponse(response, signal);
  }

  async readPublicStream(
    path: string,
  ): Promise<AsyncIterable<Uint8Array> | undefined> {
    const { response, signal } = await this.request(
      `${this.publicUrl}/${encodePath(path)}`,
      {
        headers: { 'Cache-Control': 'no-cache' },
        credentials: 'omit',
      },
    );
    return downloadResponse(response, signal);
  }

  async fileInfo(
    path: string,
  ): Promise<{ size: number; versionToken: string } | undefined> {
    const { response, signal } = await this.request(
      `${this.storageUrl}/${encodePath(path)}`,
      {
        headers: this.authenticatedHeaders(),
      },
    );
    if (response.status === 404) {
      await discardResponse(response);
      return undefined;
    }
    await requireStatus(response, [200]);
    const info = requireRecord(await readJson(response, signal));
    const checksums = requireRecord(info.checksums);
    if (
      'children' in info ||
      typeof checksums.sha256 !== 'string' ||
      !SHA256_PATTERN.test(checksums.sha256)
    ) {
      throw new Error(
        'Artifactory file information requires a file with a SHA-256 checksum.',
      );
    }
    return {
      size: requireSize(info.size),
      versionToken: checksums.sha256.toLowerCase(),
    };
  }

  async metadata(
    path: string,
  ): Promise<{ cacheControl: string; contentType: string }> {
    const { response, signal } = await this.request(
      `${this.storageUrl}/${encodePath(path)}?properties=artifactory.content-type,atlas.cache-control`,
      { headers: this.authenticatedHeaders() },
    );
    await requireStatus(response, [200]);
    const properties = requireRecord(
      requireRecord(await readJson(response, signal)).properties,
    );
    return {
      contentType: requireProperty(properties['artifactory.content-type']),
      cacheControl: requireProperty(properties['atlas.cache-control']),
    };
  }

  async deliveryMetadata(
    path: string,
  ): Promise<{ cacheControl: string; contentType: string }> {
    const { response } = await this.request(
      `${this.publicUrl}/${encodePath(path)}`,
      {
        method: 'HEAD',
        headers: { 'Cache-Control': 'no-cache' },
        credentials: 'omit',
      },
    );
    await requireStatus(response, [200]);
    const cacheControl = response.headers.get('cache-control')?.trim();
    const contentType = response.headers.get('content-type')?.trim();
    if (!cacheControl || !contentType) {
      throw new Error(
        'Artifactory delivery requires actual Cache-Control and Content-Type response headers.',
      );
    }
    return { cacheControl, contentType };
  }

  async list(prefix: string): Promise<AtlasPublicationListedObject[]> {
    const normalizedPrefix = prefix.replace(/\/$/, '');
    const suffix = normalizedPrefix ? `/${encodePath(normalizedPrefix)}` : '';
    if (prefix && !normalizedPrefix)
      throw new Error('Artifactory listing prefix must be relative.');
    const { response, signal } = await this.request(
      `${this.storageUrl}${suffix}?list&deep=1&listFolders=0`,
      {
        headers: this.authenticatedHeaders(),
      },
    );
    if (response.status === 404) {
      await discardResponse(response);
      return [];
    }
    await requireStatus(response, [200]);
    const listing = requireRecord(await readJson(response, signal));
    if (!Array.isArray(listing.files))
      throw new Error('Artifactory returned an invalid file listing.');
    const paths = new Set<string>();
    return listing.files.map((file: unknown) => {
      const item = requireRecord(file);
      if (
        typeof item.uri !== 'string' ||
        !item.uri.startsWith('/') ||
        item.folder !== false
      ) {
        throw new Error('Artifactory returned an invalid file listing entry.');
      }
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
      /[\r\n\0]/.test(input.contentType) ||
      /[\r\n\0]/.test(input.cacheControl)
    ) {
      throw new Error(
        'Artifactory upload requires a valid SHA-256 checksum, Content-Type, and Cache-Control.',
      );
    }
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
    await requireMutationStatus(response, [200, 201]);
    await discardResponse(response);
  }

  async remove(path: string): Promise<void> {
    const { response } = await this.request(
      `${this.repositoryUrl}/${encodePath(path)}`,
      {
        method: 'DELETE',
        headers: this.authenticatedHeaders(),
      },
    );
    await requireMutationStatus(response, [204, 404]);
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
      throw transportError(
        'Artifactory request failed; check connectivity, TLS trust, and request timeout.',
        error,
        signal,
      );
    }
  }
}

function validateBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Artifactory requires valid HTTPS base URLs.');
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    /[\\%\s]/.test(value)
  ) {
    throw new Error(
      'Artifactory base URLs require HTTPS without credentials, query, fragment, or encoded paths.',
    );
  }
  const rawPath = value.replace(/^https:\/\/[^/]+/, '').replace(/\/$/, '');
  if (rawPath) encodePath(rawPath.replace(/^\//, ''));
  return url.href.replace(/\/$/, '');
}

function encodePath(path: string): string {
  const segments = path.split('/');
  if (
    !path ||
    /[%\\;?#\u0000-\u001f\u007f]/.test(path) ||
    segments.some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    throw new Error(
      'Artifactory paths must be nonempty relative paths without traversal or reserved delimiters.',
    );
  }
  return segments.map(encodeURIComponent).join('/');
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Artifactory returned invalid storage information.');
  }
  return value as Record<string, unknown>;
}

function requireProperty(value: unknown): string {
  if (
    !Array.isArray(value) ||
    value.length !== 1 ||
    typeof value[0] !== 'string' ||
    !value[0].trim() ||
    /[\r\n\0]/.test(value[0])
  ) {
    throw new Error(
      'Artifactory requires single-valued publication metadata properties.',
    );
  }
  return value[0];
}

function requireSize(value: unknown): number {
  const size =
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof size !== 'number' || !Number.isSafeInteger(size) || size < 0) {
    throw new Error('Artifactory returned an invalid file size.');
  }
  return size;
}

function lastModified(value: unknown): { lastModified?: string } {
  if (value === undefined) return {};
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new Error('Artifactory returned an invalid file timestamp.');
  }
  return { lastModified: value };
}

async function readJson(
  response: Response,
  signal: AbortSignal,
): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    throw transportError(
      'Artifactory returned an unreadable JSON response.',
      error,
      signal,
    );
  }
}

async function requireStatus(
  response: Response,
  accepted: readonly number[],
): Promise<void> {
  if (accepted.includes(response.status)) return;
  await discardResponse(response);
  throw Object.assign(
    new Error(`Artifactory request returned HTTP ${response.status}.`),
    { status: response.status },
  );
}

async function requireMutationStatus(
  response: Response,
  accepted: readonly number[],
): Promise<void> {
  if (accepted.includes(response.status)) return;
  if (
    response.status === 408 ||
    response.status === 425 ||
    response.status === 429 ||
    response.status >= 500
  ) {
    await discardResponse(response);
    throw unknownMutationOutcome();
  }
  await requireStatus(response, accepted);
}

function unknownMutationOutcome(): Error {
  return Object.assign(
    new Error(
      'Artifactory mutation outcome is unknown; stop publishers and reconcile outstanding requests before retrying.',
    ),
    { publicationOutcomeUnknown: true },
  );
}

async function discardResponse(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Discarded server bodies must never expose authentication details through errors.
  }
}

async function downloadResponse(
  response: Response,
  signal: AbortSignal,
): Promise<AsyncIterable<Uint8Array> | undefined> {
  if (response.status === 404) {
    await discardResponse(response);
    return undefined;
  }
  await requireStatus(response, [200]);
  if (!response.body) throw new Error('Artifactory download returned no body.');
  return readBody(response.body, signal);
}

async function* readBody(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
): AsyncIterable<Uint8Array> {
  const reader = body.getReader();
  let completed = false;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) {
        completed = true;
        return;
      }
      yield chunk.value;
    }
  } catch (error) {
    throw transportError('Artifactory download stream failed.', error, signal);
  } finally {
    try {
      if (!completed) await reader.cancel();
    } catch {
      // Preserve the sanitized download error if cancellation also fails.
    }
    reader.releaseLock();
  }
}

function transportError(
  message: string,
  error: unknown,
  signal: AbortSignal,
): Error {
  if (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'SyntaxError'
  )
    return new Error(message);

  const code =
    transportFailureCode(error) ??
    (signal.aborted ? transportFailureCode(signal.reason) : undefined);
  return Object.assign(new Error(message), code ? { code } : {});
}

function transportFailureCode(error: unknown): string | undefined {
  const visited = new Set<object>();
  let failure = error;
  while (
    typeof failure === 'object' &&
    failure !== null &&
    !visited.has(failure)
  ) {
    visited.add(failure);
    if ('name' in failure && failure.name === 'TimeoutError')
      return 'ETIMEDOUT';
    const code = 'code' in failure ? failure.code : undefined;
    if (typeof code === 'string') {
      if (TRANSIENT_NETWORK_CODES.has(code)) return code;
      if (TRANSPORT_TIMEOUT_CODES.has(code)) return 'ETIMEDOUT';
    }
    failure = 'cause' in failure ? failure.cause : undefined;
  }
  return undefined;
}
