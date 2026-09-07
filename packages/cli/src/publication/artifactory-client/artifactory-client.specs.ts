import { beforeEach, describe, expect, it } from '@jest/globals';
import { ArtifactoryClientDriver } from './artifactory-client.driver.js';

describe('ArtifactoryClient', () => {
  let driver: ArtifactoryClientDriver;

  beforeEach(() => {
    driver = new ArtifactoryClientDriver();
  });

  it.each([
    { url: 'http://example.invalid/artifactory' },
    { url: 'https://user:secret@example.invalid/artifactory' },
    { url: 'https://example.invalid/artifactory?secret=value' },
    { publicUrl: 'https://example.invalid/assets#fragment' },
    { url: 'https://example.invalid/../artifactory' },
    { repository: '../repository' },
    { prefix: '' },
    { prefix: '/atlas' },
    { prefix: 'atlas/%2e%2e' },
    { accessToken: '' },
    { accessToken: 'token\nheader' },
    { requestTimeoutMs: 0 },
  ])('should reject configuration when options are unsafe %j', (options) => {
    driver.given.options(options);

    expect(driver.when.construct).toThrow(/Artifactory/);
  });

  it('should return authoritative checksum and size when file information is valid', async () => {
    driver.given.fileInfo({});

    expect(await driver.when.fileInfo()).toEqual(driver.get.fileInfo());
  });

  it('should return missing when file information returns 404', async () => {
    driver.given.status(404);

    expect(await driver.when.fileInfo()).toBeUndefined();
  });

  it.each([401, 403, 500])(
    'should report HTTP failure when file information returns %i',
    async (status) => {
      driver.given.status(status);

      await expect(driver.when.fileInfo()).rejects.toThrow(`HTTP ${status}`);
    },
  );

  it.each([401, 403, 408, 429, 500, 503])(
    'should preserve HTTP status for caller retry decisions when request returns %i',
    async (status) => {
      driver.given.status(status);

      await expect(driver.when.fileInfo()).rejects.toMatchObject({ status });
    },
  );

  it.each([
    { checksums: {} },
    { size: '-1' },
    { size: '10x' },
    { children: [] },
  ])(
    'should reject file information when response is malformed %j',
    async (info) => {
      driver.given.fileInfo(info);

      await expect(driver.when.fileInfo()).rejects.toThrow(/Artifactory/);
    },
  );

  it('should hide server content when JSON is malformed', async () => {
    driver.given.text('sensitive unexpected response');

    await expect(driver.when.fileInfo()).rejects.toThrow(
      'Artifactory returned an unreadable JSON response.',
    );
  });

  it('should hide transport details when network request rejects', async () => {
    driver.given.failure('sensitive token in network failure');

    await expect(driver.when.fileInfo()).rejects.toThrow(
      'Artifactory request failed; check connectivity, TLS trust, and request timeout.',
    );
  });

  it.each([
    'ECONNABORTED',
    'ECONNRESET',
    'EAI_AGAIN',
    'ENETUNREACH',
    'ETIMEDOUT',
    'UND_ERR_CONNECT_TIMEOUT',
    'UND_ERR_SOCKET',
  ])(
    'should preserve safe transport code when request fails with %s',
    async (code) => {
      driver.given.transportFailure({ code });

      await expect(driver.when.fileInfo()).rejects.toMatchObject({ code });
    },
  );

  it('should preserve nested transport code when fetch wraps a network failure', async () => {
    driver.given.transportFailure({ causeCode: 'ECONNRESET' });

    await expect(driver.when.fileInfo()).rejects.toMatchObject({
      code: 'ECONNRESET',
    });
  });

  it.each(['UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT'])(
    'should normalize transport timeout when Undici fails with %s',
    async (code) => {
      driver.given.transportFailure({ code });

      await expect(driver.when.fileInfo()).rejects.toMatchObject({
        code: 'ETIMEDOUT',
      });
    },
  );

  it('should mark timeout as retryable when request deadline expires', async () => {
    driver.given.transportFailure({ name: 'TimeoutError' });

    await expect(driver.when.fileInfo()).rejects.toMatchObject({
      code: 'ETIMEDOUT',
    });
  });

  it.each([
    'CERT_HAS_EXPIRED',
    'DEPTH_ZERO_SELF_SIGNED_CERT',
    'ERR_INVALID_URL',
  ])(
    'should avoid retry metadata when request fails permanently with %s',
    async (code) => {
      driver.given.transportFailure({ causeCode: code });

      await expect(driver.when.fileInfo()).rejects.not.toHaveProperty('code');
    },
  );

  it('should discard unsafe codes when transport details contain credentials', async () => {
    driver.given.transportFailure({ code: driver.get.secret() });

    await expect(driver.when.fileInfo()).rejects.not.toHaveProperty('code');
  });

  it('should discard raw causes when transport failure is retryable', async () => {
    driver.given.transportFailure({ causeCode: 'ECONNRESET' });

    await expect(driver.when.fileInfo()).rejects.not.toHaveProperty('cause');
  });

  it('should hide credentials when nested transport failure is retryable', async () => {
    driver.given.transportFailure({ causeCode: 'ECONNRESET' });

    await expect(driver.when.fileInfo()).rejects.not.toThrow(
      driver.get.secret(),
    );
  });

  it('should terminate sanitization when transport causes form a cycle', async () => {
    driver.given.circularFailure('UNKNOWN');

    await expect(driver.when.fileInfo()).rejects.not.toHaveProperty('code');
  });

  it('should preserve retry metadata when JSON body transport fails', async () => {
    driver.given.bodyFailure({ causeCode: 'UND_ERR_SOCKET' });

    await expect(driver.when.fileInfo()).rejects.toMatchObject({
      code: 'UND_ERR_SOCKET',
    });
  });

  it('should preserve timeout classification when JSON body aborts after deadline', async () => {
    driver.given.bodyTimeout('TimeoutError');

    await expect(driver.when.fileInfo()).rejects.toMatchObject({
      code: 'ETIMEDOUT',
    });
  });

  it('should avoid retry metadata when JSON content is malformed', async () => {
    driver.given.text('not JSON');

    await expect(driver.when.fileInfo()).rejects.not.toHaveProperty('code');
  });

  it('should avoid retry metadata when malformed JSON coincides with request timeout', async () => {
    driver.given.expiredDeadline('TimeoutError');
    driver.given.text('not JSON');

    await expect(driver.when.fileInfo()).rejects.not.toHaveProperty('code');
  });

  it('should read declared publication metadata when stored properties are valid', async () => {
    driver.given.properties({});

    await expect(driver.when.storedMetadata()).resolves.toEqual(
      driver.get.storedMetadata(),
    );
  });

  it('should authenticate property reads when loading publication metadata', async () => {
    driver.given.properties({});

    await driver.when.storedMetadata();

    expect(driver.get.request()).toMatchObject({
      url: driver.get.metadataUrl(),
      headers: { Authorization: driver.get.authorization() },
    });
  });

  it.each([
    { 'artifactory.content-type': [] },
    { 'atlas.cache-control': [] },
    { 'artifactory.content-type': ['application/json', 'text/plain'] },
    { 'atlas.cache-control': 'no-cache' },
    { 'artifactory.content-type': [42] },
    { 'atlas.cache-control': [' '] },
    { 'artifactory.content-type': ['application/json\nheader'] },
  ])(
    'should reject stored metadata when publication property is malformed %j',
    async (properties) => {
      driver.given.properties(properties);

      await expect(driver.when.storedMetadata()).rejects.toThrow(
        'single-valued publication metadata',
      );
    },
  );

  it('should reject stored metadata when properties are missing', async () => {
    driver.given.json({});

    await expect(driver.when.storedMetadata()).rejects.toThrow(
      'invalid storage information',
    );
  });

  it('should preserve permission status when stored metadata is inaccessible', async () => {
    driver.given.status(403);

    await expect(driver.when.storedMetadata()).rejects.toMatchObject({
      status: 403,
    });
  });

  it('should use actual delivery headers when public endpoint responds', async () => {
    driver.given.deliveryHeaders({
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/json',
    });

    expect(await driver.when.metadata()).toEqual({
      cacheControl: 'no-cache',
      contentType: 'application/json',
    });
  });

  it('should omit publishing credentials when delivery shares Artifactory origin', async () => {
    driver.given.options({ publicUrl: driver.get.artifactoryUrl() });
    driver.given.deliveryHeaders({
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/json',
    });

    await driver.when.metadata();

    expect(driver.get.request().headers).toEqual({
      'Cache-Control': 'no-cache',
    });
  });

  it('should request configured delivery URL when reading public metadata', async () => {
    driver.given.deliveryHeaders({
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/json',
    });

    await driver.when.metadata();

    expect(driver.get.request()).toMatchObject({
      url: driver.get.publicUrl(),
      method: 'HEAD',
      credentials: 'omit',
    });
  });

  it.each<Record<string, string>>([
    { 'Content-Type': 'application/json' },
    { 'Cache-Control': 'no-cache' },
  ])(
    'should reject delivery metadata when required headers are absent %j',
    async (headers) => {
      driver.given.deliveryHeaders(headers);

      await expect(driver.when.metadata()).rejects.toThrow(
        'actual Cache-Control and Content-Type',
      );
    },
  );

  it('should fail delivery verification when public object is missing', async () => {
    driver.given.status(404);

    await expect(driver.when.metadata()).rejects.toThrow('HTTP 404');
  });

  it('should preserve scoped paths when listing nested artifacts', async () => {
    driver.given.listing({});

    expect(await driver.when.list('previews/')).toEqual(
      driver.get.listing('previews'),
    );
  });

  it('should return empty listing when prefix is missing', async () => {
    driver.given.status(404);

    expect(await driver.when.list('previews/')).toEqual([]);
  });

  it.each([
    { uri: '/../escape' },
    { uri: '//escape' },
    { uri: '/%2e%2e/escape' },
    { folder: true },
    { size: -1 },
    { lastModified: 'invalid' },
  ])(
    'should reject complete listing when an entry is unsafe %j',
    async (entry) => {
      driver.given.listing(entry);

      await expect(driver.when.list('previews')).rejects.toThrow(/Artifactory/);
    },
  );

  it('should reject duplicate listing entries when server repeats a path', async () => {
    driver.given.duplicateListing(2);

    await expect(driver.when.list('previews')).rejects.toThrow('duplicate');
  });

  it('should reject malformed listing when files are absent', async () => {
    driver.given.json({});

    await expect(driver.when.list('previews')).rejects.toThrow(
      'invalid file listing',
    );
  });

  it('should upload integrity and MIME metadata when publishing bytes', async () => {
    driver.given.status(201);

    await driver.when.upload();

    expect(driver.get.request()).toMatchObject({
      url: `${driver.get.privateUrl()};artifactory.content-type=text%2Fjavascript%3B%20charset%3Dutf-8;atlas.cache-control=public%2C%20max-age%3D31536000%2C%20immutable`,
      method: 'PUT',
      headers: {
        Authorization: driver.get.authorization(),
        'Content-Type': 'text/javascript; charset=utf-8',
        'X-Checksum-Sha256': driver.get.digest(),
      },
    });
  });

  it('should reject redirects when sending authenticated requests', async () => {
    driver.given.status(201);

    await driver.when.upload();

    expect(driver.get.request().redirect).toBe('error');
  });

  it('should apply configured timeout when requesting Artifactory', async () => {
    driver.given.status(201);

    await driver.when.upload();

    expect(driver.get.timeout()).toHaveBeenCalledWith(
      driver.get.requestTimeout(),
    );
  });

  it('should not retry mutations when upload fails', async () => {
    driver.given.status(503);

    await driver.when.upload().catch(() => undefined);

    expect(driver.get.requests()).toHaveBeenCalledTimes(1);
  });

  it.each([408, 425, 429, 500, 502, 503, 504])(
    'should mark mutation outcome unknown when upload returns %i',
    async (status) => {
      driver.given.status(status);

      await expect(driver.when.upload()).rejects.toMatchObject({
        publicationOutcomeUnknown: true,
      });
    },
  );

  it('should omit retryable HTTP status when upload outcome is unknown', async () => {
    driver.given.status(503);

    await expect(driver.when.upload()).rejects.not.toHaveProperty('status');
  });

  it('should require reconciliation when upload response is ambiguous', async () => {
    driver.given.status(504);

    await expect(driver.when.upload()).rejects.toThrow(
      'Artifactory mutation outcome is unknown; stop publishers and reconcile outstanding requests before retrying.',
    );
  });

  it('should mark mutation outcome unknown when upload transport disconnects', async () => {
    driver.given.transportFailure({ causeCode: 'ECONNRESET' });

    await expect(driver.when.upload()).rejects.toMatchObject({
      publicationOutcomeUnknown: true,
    });
  });

  it('should omit retryable transport code when upload outcome is unknown', async () => {
    driver.given.transportFailure({ causeCode: 'ECONNRESET' });

    await expect(driver.when.upload()).rejects.not.toHaveProperty('code');
  });

  it('should omit raw causes when upload outcome is unknown', async () => {
    driver.given.transportFailure({ causeCode: 'ECONNRESET' });

    await expect(driver.when.upload()).rejects.not.toHaveProperty('cause');
  });

  it('should hide credentials when upload outcome is unknown', async () => {
    driver.given.transportFailure({ causeCode: 'ECONNRESET' });

    await expect(driver.when.upload()).rejects.not.toThrow(driver.get.secret());
  });

  it.each([400, 401, 403, 409])(
    'should preserve confirmed rejection status when upload returns %i',
    async (status) => {
      driver.given.status(status);

      await expect(driver.when.upload()).rejects.toMatchObject({ status });
    },
  );

  it('should preserve unknown outcome when delete response times out', async () => {
    driver.given.transportFailure({ name: 'TimeoutError' });

    await expect(driver.when.remove()).rejects.toMatchObject({
      publicationOutcomeUnknown: true,
    });
  });

  it('should omit retry status when delete returns a gateway failure', async () => {
    driver.given.status(502);

    await expect(driver.when.remove()).rejects.not.toHaveProperty('status');
  });

  it.each([
    '../escape',
    '/escape',
    'folder//file',
    'folder/file;property=value',
    'folder/%2fescape',
    'folder\\file',
    'folder/',
  ])('should reject mutation when object path is unsafe %s', async (path) => {
    driver.given.path(path);

    await expect(driver.when.remove()).rejects.toThrow('paths must be');
  });

  it.each([204, 404])(
    'should complete removal when delete returns %i',
    async (status) => {
      driver.given.status(status);

      await expect(driver.when.remove()).resolves.toBeUndefined();
    },
  );

  it('should report permissions failure when delete is denied', async () => {
    driver.given.status(403);

    await expect(driver.when.remove()).rejects.toThrow('HTTP 403');
  });

  it('should stream downloaded bytes when object exists', async () => {
    driver.given.download('complete');

    expect(await driver.when.download()).toEqual(driver.get.bytes());
  });

  it('should stream actual delivery bytes when public object exists', async () => {
    driver.given.download('complete');

    expect(await driver.when.publicDownload()).toEqual(driver.get.bytes());
  });

  it('should exclude publishing credentials when downloading public bytes on the same origin', async () => {
    driver.given.options({ publicUrl: driver.get.artifactoryUrl() });
    driver.given.download('complete');

    await driver.when.publicDownload();

    expect(driver.get.request().headers).toEqual({
      'Cache-Control': 'no-cache',
    });
  });

  it('should disable credentials redirects and caching when downloading public bytes', async () => {
    driver.given.download('complete');

    await driver.when.publicDownload();

    expect(driver.get.request()).toMatchObject({
      url: driver.get.publicUrl(),
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
    });
  });

  it('should return missing public stream when delivery returns 404', async () => {
    driver.given.status(404);

    expect(await driver.when.publicDownload()).toBeUndefined();
  });

  it.each([401, 403, 500])(
    'should report delivery HTTP failure when public download returns %i',
    async (status) => {
      driver.given.status(status);

      await expect(driver.when.publicDownload()).rejects.toThrow(
        `HTTP ${status}`,
      );
    },
  );

  it('should sanitize download failure when delivery body fails', async () => {
    driver.given.download('failure');

    await expect(driver.when.publicDownload()).rejects.toThrow(
      'Artifactory download stream failed.',
    );
  });

  it('should sanitize transport failure when delivery request rejects', async () => {
    driver.given.failure('sensitive transport details');

    await expect(driver.when.publicDownload()).rejects.toThrow(
      'Artifactory request failed; check connectivity, TLS trust, and request timeout.',
    );
  });

  it('should return missing stream when download returns 404', async () => {
    driver.given.status(404);

    expect(await driver.when.download()).toBeUndefined();
  });

  it('should hide transport details when download body fails', async () => {
    driver.given.download('failure');

    await expect(driver.when.download()).rejects.toThrow(
      'Artifactory download stream failed.',
    );
  });

  it('should preserve retry metadata when download stream disconnects', async () => {
    driver.given.bodyFailure({ causeCode: 'UND_ERR_SOCKET' });

    await expect(driver.when.download()).rejects.toMatchObject({
      code: 'UND_ERR_SOCKET',
    });
  });

  it('should classify download timeout when body aborts after request deadline', async () => {
    driver.given.bodyTimeout('TimeoutError');

    await expect(driver.when.download()).rejects.toMatchObject({
      code: 'ETIMEDOUT',
    });
  });

  it('should avoid retry metadata when body was cancelled without timeout', async () => {
    driver.given.bodyTimeout('AbortError');

    await expect(driver.when.download()).rejects.not.toHaveProperty('code');
  });

  it('should hide credentials when download transport is retryable', async () => {
    driver.given.bodyFailure({ causeCode: 'UND_ERR_SOCKET' });

    await expect(driver.when.publicDownload()).rejects.not.toThrow(
      driver.get.secret(),
    );
  });

  it('should cancel unread body when consumer stops reading', async () => {
    driver.given.download('cancel-failure');

    await driver.when.cancelDownload();

    expect(driver.get.cancellation()).toHaveBeenCalledTimes(1);
  });
});
