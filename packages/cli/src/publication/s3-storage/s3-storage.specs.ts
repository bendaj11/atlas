import { faker } from '@faker-js/faker';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { S3StorageDriver } from './s3-storage.driver.js';

function sdkError(httpStatusCode: number, name = 'Error'): Error {
  return Object.assign(new Error(name), {
    name,
    $metadata: { httpStatusCode },
  });
}

describe('S3PublicationStorage', () => {
  let driver: S3StorageDriver;

  beforeEach(() => {
    driver = new S3StorageDriver();
  });

  it('should use a create-only condition when an immutable object is created', async () => {
    await driver.when.created('apps/orders/1.4.0/manifest.json', {
      cacheControl: 'immutable',
      contentType: 'application/json',
    });

    expect(driver.get.commands()[0]).toMatchObject({
      Bucket: driver.get.bucket(),
      Key: 'apps/orders/1.4.0/manifest.json',
      IfNoneMatch: '*',
      CacheControl: 'immutable',
      ContentType: 'application/json',
    });
  });

  it('should prefix object keys when a prefix is configured', async () => {
    driver.given.options({ prefix: '/platform/' });

    await driver.when.created('registry.json', {
      cacheControl: 'no-cache',
      contentType: 'application/json',
    });

    expect(driver.get.commands()[0]).toMatchObject({
      Key: 'platform/registry.json',
    });
  });

  it('should use a version condition when a mutable object is replaced', async () => {
    const versionToken = faker.string.alphanumeric(8);

    await driver.when.replaced('registry.json', { versionToken });

    expect(driver.get.commands()[0]).toMatchObject({ IfMatch: versionToken });
  });

  it('should use a create-only condition when a replace is create-only', async () => {
    await driver.when.replaced('registry.json', { createOnly: true });

    expect(driver.get.commands()[0]).toMatchObject({ IfNoneMatch: '*' });
  });

  it('should report an existing immutable object when create hits a precondition failure', async () => {
    driver.given.failure(sdkError(412));

    await expect(
      driver.when.created('apps/a/manifest.json', {
        cacheControl: 'immutable',
        contentType: 'application/json',
      }),
    ).rejects.toThrow(
      'Immutable publication object already exists: apps/a/manifest.json',
    );
  });

  it('should report a write conflict when replace hits a precondition failure', async () => {
    driver.given.failure(sdkError(412));

    await expect(
      driver.when.replaced('registry.json', { versionToken: 'x' }),
    ).rejects.toThrow(
      'Conditional publication write conflicted: registry.json',
    );
  });

  it('should return undefined when a read object is missing', async () => {
    driver.given.failure(sdkError(404, 'NoSuchKey'));

    expect(await driver.get.read('registry.json')).toBeUndefined();
  });

  it('should wrap other read failures with the operation when the SDK rejects', async () => {
    driver.given.failure(sdkError(500));

    await expect(driver.get.read('registry.json')).rejects.toThrow(
      'S3-compatible storage could not read registry.json.',
    );
  });

  it('should reject inspect when the object lacks cache or content metadata', async () => {
    driver.given.response(() => ({ ContentType: 'application/json' }));

    await expect(driver.get.inspect('registry.json')).rejects.toThrow(
      /missing Cache-Control or Content-Type metadata/,
    );
  });

  it('should map ETag and LastModified when inspect succeeds', async () => {
    const lastModified = faker.date.past();
    driver.given.response(() => ({
      CacheControl: 'no-cache',
      ContentType: 'application/json',
      ContentLength: 12,
      ETag: 'etag-1',
      LastModified: lastModified,
    }));

    expect(await driver.get.inspect('registry.json')).toStrictEqual({
      cacheControl: 'no-cache',
      contentType: 'application/json',
      size: 12,
      versionToken: 'etag-1',
      lastModified: lastModified.toISOString(),
    });
  });

  it('should follow continuation tokens and strip the prefix when listing', async () => {
    driver.given.options({ prefix: 'platform' }).given.response((command) => {
      const input = (command as ListObjectsV2Command).input;

      return input.ContinuationToken
        ? { Contents: [{ Key: 'platform/b.json', Size: 2 }] }
        : {
            Contents: [{ Key: 'platform/a.json', Size: 1 }],
            IsTruncated: true,
            NextContinuationToken: 'next',
          };
    });

    expect(await driver.get.list('apps/')).toStrictEqual([
      { path: 'a.json', size: 1 },
      { path: 'b.json', size: 2 },
    ]);
  });

  it('should wrap list failures with the prefix when the SDK rejects', async () => {
    driver.given.failure(sdkError(500));

    await expect(driver.get.list('apps/')).rejects.toThrow(
      'S3-compatible storage could not list apps/.',
    );
  });

  it('should ignore missing objects when removing', async () => {
    driver.given.failure(sdkError(404));

    await expect(driver.get.remove('registry.json')).resolves.toBeUndefined();
  });
});
