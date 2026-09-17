import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import { ArtifactoryClient } from './artifactory-client.js';
import type { ArtifactoryConnectionOptions } from './types.js';

interface TransportFailureDetails {
  readonly code?: string;
  readonly name?: string;
  readonly causeCode?: string;
}

export class ArtifactoryClientDriver {
  private readonly options: ArtifactoryConnectionOptions = {
    url: `https://${faker.internet.domainName()}/custom/artifactory`,
    repository: faker.string.alphanumeric(12),
    prefix: `atlas/${faker.string.alphanumeric(10)}`,
    accessToken: faker.string.alphanumeric(40),
    publicUrl: `https://${faker.internet.domainName()}/assets`,
    requestTimeoutMs: faker.number.int({ min: 1000, max: 5000 }),
  };
  private readonly path = `apps/${faker.string.uuid()}/1.0.0/main file.js`;
  private readonly digest = faker.string.hexadecimal({
    length: 64,
    prefix: '',
    casing: 'lower',
  });
  private readonly size = faker.number.int({ min: 1, max: 10000 });
  private readonly timestamp = faker.date.recent().toISOString();
  private readonly bytes = new TextEncoder().encode(faker.lorem.sentence());
  private readonly network = jest.fn<typeof fetch>();
  private readonly signal = new AbortController().signal;
  private readonly timeout = jest
    .fn<(milliseconds: number) => AbortSignal>()
    .mockReturnValue(this.signal);
  private readonly cancel = jest.fn<() => void>();
  private overrides: Partial<ArtifactoryConnectionOptions> = {};
  private selectedPath = this.path;

  readonly given = {
    options: (options: Partial<ArtifactoryConnectionOptions>) => {
      this.overrides = options;
    },
    path: (path: string) => {
      this.selectedPath = path;
    },
    status: (status: number) => {
      this.network.mockResolvedValue(new Response(null, { status }));
    },
    failure: (message: string) => {
      this.network.mockRejectedValue(new Error(message));
    },
    transportFailure: (details: TransportFailureDetails) => {
      this.network.mockRejectedValue(
        createTransportFailure(details, this.options.accessToken),
      );
    },
    circularFailure: (code: string) => {
      const error = createTransportFailure({ code }, this.options.accessToken);
      this.network.mockRejectedValue(Object.assign(error, { cause: error }));
    },
    bodyFailure: (details: TransportFailureDetails) => {
      this.network.mockResolvedValue(
        new Response(
          new ReadableStream<Uint8Array>({
            start: (controller) => {
              controller.error(
                createTransportFailure(details, this.options.accessToken),
              );
            },
          }),
        ),
      );
    },
    expiredDeadline: (reason: string) => {
      const controller = new AbortController();
      controller.abort(new DOMException(this.options.accessToken, reason));
      this.timeout.mockReturnValue(controller.signal);
    },
    bodyTimeout: (reason: string) => {
      this.given.expiredDeadline(reason);
      this.given.bodyFailure({ name: 'AbortError' });
    },
    fileInfo: (overrides: Record<string, unknown>) => {
      this.network.mockResolvedValue(
        Response.json({
          size: String(this.size),
          checksums: { sha256: this.digest },
          ...overrides,
        }),
      );
    },
    properties: (overrides: Record<string, unknown>) => {
      this.network.mockResolvedValue(
        Response.json({
          properties: {
            'artifactory.content-type': ['application/json'],
            'atlas.cache-control': ['no-cache, max-age=0, must-revalidate'],
            ...overrides,
          },
        }),
      );
    },
    deliveryHeaders: (headers: Record<string, string>) => {
      this.network.mockResolvedValue(new Response(null, { headers }));
    },
    listing: (overrides: Record<string, unknown>) => {
      this.network.mockResolvedValue(
        Response.json({
          files: [
            {
              uri: `/${this.path}`,
              size: this.size,
              folder: false,
              lastModified: this.timestamp,
              ...overrides,
            },
          ],
        }),
      );
    },
    duplicateListing: (count: number) => {
      this.network.mockResolvedValue(
        Response.json({
          files: Array.from({ length: count }, () => ({
            uri: `/${this.path}`,
            size: this.size,
            folder: false,
          })),
        }),
      );
    },
    json: (value: unknown) => {
      this.network.mockResolvedValue(Response.json(value));
    },
    text: (value: string) => {
      this.network.mockResolvedValue(new Response(value));
    },
    download: (behavior: 'complete' | 'failure' | 'cancel-failure') => {
      this.network.mockResolvedValue(
        new Response(
          new ReadableStream<Uint8Array>({
            start: (controller) => {
              if (behavior === 'failure')
                controller.error(new Error(this.options.accessToken));
              else {
                controller.enqueue(this.bytes);
                if (behavior === 'complete') controller.close();
              }
            },
            cancel: () => {
              this.cancel();
              if (behavior === 'cancel-failure')
                throw new Error(this.options.accessToken);
            },
          }),
        ),
      );
    },
  };

  readonly when = {
    construct: () =>
      new ArtifactoryClient(
        { ...this.options, ...this.overrides },
        { fetch: this.network, timeoutSignal: this.timeout },
      ),
    fileInfo: () => this.when.construct().fileInfo(this.selectedPath),
    storedMetadata: () => this.when.construct().metadata(this.selectedPath),
    metadata: () => this.when.construct().deliveryMetadata(this.selectedPath),
    list: (prefix: string) => this.when.construct().list(prefix),
    upload: () =>
      this.when.construct().upload({
        path: this.selectedPath,
        bytes: this.bytes,
        contentType: 'text/javascript; charset=utf-8',
        cacheControl: 'public, max-age=31536000, immutable',
        sha256: this.digest,
      }),
    remove: () => this.when.construct().remove(this.selectedPath),
    download: async () => {
      const stream = await this.when.construct().readStream(this.selectedPath);
      if (!stream) return undefined;
      const chunks: Uint8Array[] = [];
      for await (const chunk of stream) chunks.push(chunk);
      return Buffer.concat(chunks);
    },
    publicDownload: async () => {
      const stream = await this.when
        .construct()
        .readPublicStream(this.selectedPath);
      if (!stream) return undefined;
      const chunks: Uint8Array[] = [];
      for await (const chunk of stream) chunks.push(chunk);
      return Buffer.concat(chunks);
    },
    cancelDownload: async () => {
      const stream = await this.when.construct().readStream(this.selectedPath);
      if (stream) for await (const chunk of stream) return chunk;
      return undefined;
    },
  };

  readonly get = {
    fileInfo: () => ({ size: this.size, versionToken: this.digest }),
    storedMetadata: () => ({
      contentType: 'application/json',
      cacheControl: 'no-cache, max-age=0, must-revalidate',
    }),
    listing: (prefix: string) => [
      {
        path: `${prefix}/${this.path}`,
        size: this.size,
        lastModified: this.timestamp,
      },
    ],
    bytes: () => Buffer.from(this.bytes),
    request: () => {
      const [url, options] = this.network.mock.calls[0] ?? [];
      return { url, ...options };
    },
    privateUrl: () =>
      `${this.options.url}/${this.options.repository}/${this.options.prefix}/${this.path.split('/').map(encodeURIComponent).join('/')}`,
    metadataUrl: () =>
      `${this.options.url}/api/storage/${this.options.repository}/${this.options.prefix}/${this.path.split('/').map(encodeURIComponent).join('/')}?properties=artifactory.content-type,atlas.cache-control`,
    publicUrl: () =>
      `${this.overrides.publicUrl ?? this.options.publicUrl}/${this.path.split('/').map(encodeURIComponent).join('/')}`,
    artifactoryUrl: () => this.options.url,
    authorization: () => `Bearer ${this.options.accessToken}`,
    secret: () => this.options.accessToken,
    digest: () => this.digest,
    timeout: () => this.timeout,
    requestTimeout: () => this.options.requestTimeoutMs,
    cancellation: () => this.cancel,
    requests: () => this.network,
  };
}

function createTransportFailure(
  details: TransportFailureDetails,
  message: string,
): Error {
  return Object.assign(new Error(message), {
    ...(details.code ? { code: details.code } : {}),
    ...(details.name ? { name: details.name } : {}),
    ...(details.causeCode
      ? {
          cause: Object.assign(new Error(message), { code: details.causeCode }),
        }
      : {}),
  });
}
