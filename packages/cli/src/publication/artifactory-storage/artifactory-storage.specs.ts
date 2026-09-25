import { faker } from '@faker-js/faker';
import { ArtifactoryStorageDriver } from './artifactory-storage.driver.js';

describe('ArtifactoryPublicationStorage', () => {
  let driver: ArtifactoryStorageDriver;

  beforeEach(() => {
    driver = new ArtifactoryStorageDriver();
  });

  it('should reject construction when external coordination is not configured', () => {
    expect(() =>
      driver.when.construct({ assertExclusivePublishing: undefined }),
    ).toThrow('requires assertExclusivePublishing');
  });

  it.each([0, -1, Infinity, 1.5])(
    'should reject construction when buffer limit is invalid: %s',
    (maxBufferedBytes) => {
      expect(() => driver.when.construct({ maxBufferedBytes })).toThrow(
        'positive safe integer',
      );
    },
  );

  it('should combine downloaded chunks when reading an existing object', async () => {
    driver.given.download('hello');

    await expect(driver.when.read()).resolves.toEqual(driver.get.bytes());
  });

  it('should return undefined when object is missing', async () => {
    await expect(driver.when.read()).resolves.toBeUndefined();
  });

  it('should return undefined when streamed object is missing', async () => {
    await expect(driver.when.readStream()).resolves.toBeUndefined();
  });

  it('should reject buffered reads when object exceeds memory limit', async () => {
    driver.given.maximumBytes(4);
    driver.given.download('hello');

    await expect(driver.when.read()).rejects.toThrow(
      'exceeds maxBufferedBytes',
    );
  });

  it('should propagate errors when reading fails', async () => {
    driver.given.failure('readStream');

    await expect(driver.when.read()).rejects.toThrow('Storage unavailable');
  });

  it('should combine authoritative version with stored metadata when inspecting an object', async () => {
    driver.given.object('present');

    await expect(driver.when.inspect()).resolves.toEqual(driver.get.metadata());
  });

  it('should avoid public delivery requests when inspected object does not exist', async () => {
    await driver.when.inspect();

    expect(driver.get.checkedDelivery()).toEqual([]);
  });

  it('should fail verification when browser delivery metadata is unavailable', async () => {
    driver.given.object('present');
    driver.given.failure('deliveryMetadata');

    await expect(driver.when.verifyDelivery()).rejects.toThrow(
      'Storage unavailable',
    );
  });

  it('should return listed files when preview listing succeeds', async () => {
    driver.given.files(2);

    await expect(driver.when.list()).resolves.toHaveLength(2);
  });

  it('should propagate errors when preview listing fails', async () => {
    driver.given.failure('list');

    await expect(driver.when.list()).rejects.toThrow('Storage unavailable');
  });

  it('should upload bytes with SHA256 when creating a missing object', async () => {
    await driver.when.create();

    expect(driver.get.uploads()).toEqual([driver.get.expectedUpload()]);
  });

  it('should consume all chunks when publishing a streamed build artifact', async () => {
    await driver.when.createStream();

    expect(driver.get.uploads()).toEqual([driver.get.expectedUpload()]);
  });

  it('should reject publication when build artifact stream fails', async () => {
    await expect(driver.when.createBrokenStream()).rejects.toThrow(
      'Build artifact stream failed',
    );
  });

  it('should reject creation when immutable object already exists', async () => {
    driver.given.object('present');

    await expect(driver.when.create()).rejects.toThrow('object already exists');
  });

  it('should avoid overwriting bytes when immutable object already exists', async () => {
    driver.given.object('present');

    await driver.when.create().catch(() => undefined);

    expect(driver.get.uploads()).toEqual([]);
  });

  it('should reject publication when metadata declares a different size', async () => {
    await expect(driver.when.createDeclaredSize(4)).rejects.toThrow(
      'size does not match',
    );
  });

  it('should reject publication when declared size exceeds buffer limit', async () => {
    await expect(driver.when.createDeclaredSize(101)).rejects.toThrow(
      'exceeds maxBufferedBytes',
    );
  });

  it('should reject publication when actual body exceeds buffer limit', async () => {
    driver.given.maximumBytes(4);

    await expect(driver.when.create()).rejects.toThrow(
      'exceeds maxBufferedBytes',
    );
  });

  it('should accept publication when body exactly matches buffer limit', async () => {
    driver.given.maximumBytes(5);

    await expect(driver.when.create()).resolves.toBeUndefined();
  });

  it('should reject mutation before accessing storage when external lock is missing', async () => {
    driver.given.lostLock(0);

    await driver.when.create().catch(() => undefined);

    expect(driver.get.authoritativeRequests()).toBe(0);
  });

  it('should avoid upload when external lock is lost after reading current state', async () => {
    driver.given.lostLock(1);

    await driver.when.create().catch(() => undefined);

    expect(driver.get.uploads()).toEqual([]);
  });

  it('should report failed publication when external lock is lost during upload', async () => {
    driver.given.lostLock(2);

    await expect(driver.when.create()).rejects.toThrow(
      'External publishing lock',
    );
  });

  it('should propagate errors when Artifactory upload fails', async () => {
    driver.given.failure('upload');

    await expect(driver.when.create()).rejects.toThrow('Storage unavailable');
  });

  it('should preserve create-only behavior when concurrent local calls target the same object', async () => {
    await driver.when.createConcurrently();

    expect(driver.get.uploads()).toHaveLength(1);
  });

  it('should upload different objects at the same time when creates target different paths', async () => {
    driver.given.slowUploads();

    await driver.when.createAt([
      `apps/${faker.string.uuid()}/1.0.0/a.js`,
      `apps/${faker.string.uuid()}/1.0.0/b.js`,
      `apps/${faker.string.uuid()}/1.0.0/c.js`,
    ]);

    expect(driver.get.peakRequests()).toBe(3);
  });

  it('should run a replacement only after in-flight creates finish', async () => {
    driver.given.slowUploads();

    await expect(
      driver.when.createAndReplaceConcurrently(),
    ).resolves.toBeDefined();
  });

  it('should check delivery of several objects at the same time up to the concurrency limit', async () => {
    driver.given.object('present');
    driver.given.slowDelivery();

    await driver.when.verifyDeliveryOf(
      ['a.js', 'b.js', 'c.js'].map((name) => `apps/example/1.0.0/${name}`),
      2,
    );

    expect(driver.get.peakRequests()).toBe(2);
  });

  it('should check delivery one object at a time when no concurrency is given', async () => {
    driver.given.object('present');
    driver.given.slowDelivery();

    await driver.when.verifyDeliveryInOrder(
      ['a.js', 'b.js'].map((name) => `apps/example/1.0.0/${name}`),
    );

    expect(driver.get.peakRequests()).toBe(1);
  });

  it('should continue processing when a previous mutation failed', async () => {
    driver.given.object('present');
    await driver.when.create().catch(() => undefined);
    driver.given.object('absent');

    await expect(driver.when.create()).resolves.toBeUndefined();
  });

  it('should reject queued replacements when an earlier upload has an unknown outcome', async () => {
    driver.given.mutationFailure({ operation: 'upload', outcome: 'unknown' });

    await expect(driver.when.replaceConcurrently()).resolves.toMatchObject([
      { status: 'rejected', reason: { publicationOutcomeUnknown: true } },
      { status: 'rejected', reason: { publicationOutcomeUnknown: true } },
    ]);
  });

  it('should avoid queued uploads when an earlier upload has an unknown outcome', async () => {
    driver.given.mutationFailure({ operation: 'upload', outcome: 'unknown' });

    await driver.when.replaceConcurrently();

    expect(driver.get.uploads()).toHaveLength(1);
  });

  it.each(['create', 'replace', 'remove'] as const)(
    'should reject later %s when an earlier upload has an unknown outcome',
    async (operation) => {
      driver.given.mutationFailure({ operation: 'upload', outcome: 'unknown' });
      await driver.when.create().catch(() => undefined);

      await expect(driver.when[operation]()).rejects.toMatchObject({
        publicationOutcomeUnknown: true,
      });
    },
  );

  it('should reject later writes when an earlier deletion has an unknown outcome', async () => {
    driver.given.object('present');
    driver.given.mutationFailure({ operation: 'remove', outcome: 'unknown' });
    await driver.when.remove().catch(() => undefined);
    driver.given.object('absent');

    await expect(driver.when.create()).rejects.toMatchObject({
      publicationOutcomeUnknown: true,
    });
  });

  it('should continue queued uploads when an earlier upload was definitely rejected', async () => {
    driver.given.mutationFailure({ operation: 'upload', outcome: 'rejected' });

    await expect(driver.when.replaceConcurrently()).resolves.toMatchObject([
      { status: 'rejected' },
      { status: 'fulfilled' },
    ]);
  });

  it('should allow inspection when a mutation has an unknown outcome', async () => {
    driver.given.mutationFailure({ operation: 'upload', outcome: 'unknown' });
    await driver.when.create().catch(() => undefined);
    driver.given.object('present');

    await expect(driver.when.inspect()).resolves.toEqual(driver.get.metadata());
  });

  it('should replace an object when version condition matches', async () => {
    driver.given.object('present');

    await driver.when.replace();

    expect(driver.get.uploads()).toEqual([driver.get.expectedUpload()]);
  });

  it('should create an object when create-only replacement finds no existing object', async () => {
    await expect(
      driver.when.replace({ createOnly: true }),
    ).resolves.toBeUndefined();
  });

  it.each([
    { versionToken: 'stale' },
    { createOnly: true },
    {},
    { createOnly: true, versionToken: 'conflict' },
  ])(
    'should reject replacement when condition does not match: %j',
    async (condition) => {
      driver.given.object('present');

      await expect(driver.when.replace(condition)).rejects.toThrow(
        'replacement condition failed',
      );
    },
  );

  it('should reject replacement when versioned object no longer exists', async () => {
    await expect(driver.when.replace()).rejects.toThrow(
      'replacement condition failed',
    );
  });

  it('should avoid replacement when the version condition is stale', async () => {
    driver.given.object('present');

    await driver.when.replace({ versionToken: 'stale' }).catch(() => undefined);

    expect(driver.get.uploads()).toEqual([]);
  });

  it('should remove only the requested file when it exists', async () => {
    driver.given.object('present');

    await driver.when.remove();

    expect(driver.get.removed()).toEqual([driver.get.path()]);
  });

  it('should skip deletion when object is already missing', async () => {
    await driver.when.remove();

    expect(driver.get.removed()).toEqual([]);
  });

  it('should avoid deletion when file information cannot be verified', async () => {
    driver.given.failure('fileInfo');

    await driver.when.remove().catch(() => undefined);

    expect(driver.get.removed()).toEqual([]);
  });

  it('should reject cleanup when deletion fails', async () => {
    driver.given.object('present');
    driver.given.failure('remove');

    await expect(driver.when.remove()).rejects.toThrow('Storage unavailable');
  });

  it('should reject lease acquisition when external lock is missing', async () => {
    driver.given.lostLock(0);

    await expect(driver.when.acquire()).rejects.toThrow(
      'External publishing lock',
    );
  });

  it('should detect lost external lock when checking an acquired lease', async () => {
    await driver.when.acquire();
    driver.given.lostLock(0);

    await expect(driver.when.assertHeld()).rejects.toThrow(
      'External publishing lock',
    );
  });

  it('should reject lease assertions when the lease was released', async () => {
    await driver.when.acquire();
    await driver.when.release();

    await expect(driver.when.assertHeld()).rejects.toThrow(
      'lease has been released',
    );
  });

  it('should allow another inner lease when outer job lock remains held', async () => {
    await driver.when.acquire();
    await driver.when.release();

    await expect(driver.when.acquire()).resolves.toBeUndefined();
  });

  it('should reject delivery verification when public delivery serves different bytes of the same size', async () => {
    driver.given.object('present');
    driver.given.publicBody('wrong');

    await expect(driver.when.verifyDelivery()).rejects.toThrow(
      'public delivery bytes do not match',
    );
  });

  it('should reject delivery verification when public delivery returns too many bytes', async () => {
    driver.given.object('present');
    driver.given.publicBody('longer');

    await expect(driver.when.verifyDelivery()).rejects.toThrow(
      'public delivery size does not match',
    );
  });

  it('should reject delivery verification when public delivery returns too few bytes', async () => {
    driver.given.object('present');
    driver.given.publicBody('hi');

    await expect(driver.when.verifyDelivery()).rejects.toThrow(
      'public delivery bytes do not match',
    );
  });

  it('should reject delivery verification when object is absent from public delivery', async () => {
    driver.given.object('present');
    driver.given.publicBody(undefined);

    await expect(driver.when.verifyDelivery()).rejects.toThrow(
      'missing from public delivery',
    );
  });

  it('should propagate delivery errors when public download fails', async () => {
    driver.given.object('present');
    driver.given.failure('readPublicStream');

    await expect(driver.when.verifyDelivery()).rejects.toThrow(
      'Storage unavailable',
    );
  });

  it('should reject publication when delivered MIME differs from requested MIME', async () => {
    driver.given.deliveryHeaders({ contentType: 'text/plain' });

    await expect(driver.when.publishAndVerify()).rejects.toThrow(
      'delivery verification failed',
    );
  });

  it('should reject publication when delivered cache policy differs from requested policy', async () => {
    driver.given.deliveryHeaders({ cacheControl: 'no-store' });

    await expect(driver.when.publishAndVerify()).rejects.toThrow(
      'delivery verification failed',
    );
  });

  it('should reject deployment writes when mutable JSON is served with immutable caching', async () => {
    await expect(driver.when.replaceMutableAndVerify()).rejects.toThrow(
      'delivery verification failed',
    );
  });

  it('should complete deployment writes when mutable JSON is served with revalidation', async () => {
    driver.given.deliveryHeaders({
      cacheControl: 'no-cache, max-age=0, must-revalidate',
    });

    await expect(
      driver.when.replaceMutableAndVerify(),
    ).resolves.toBeUndefined();
  });

  it('should fail publishing when uploaded bytes differ at the public root', async () => {
    driver.given.publicBody('wrong');

    await expect(driver.when.publishAndVerify()).rejects.toThrow(
      'public delivery bytes do not match',
    );
  });

  it('should allow authoritative inspection when browser delivery is stale', async () => {
    driver.given.object('present');
    driver.given.publicBody('wrong');

    await expect(driver.when.inspect()).resolves.toEqual(driver.get.metadata());
  });

  it('should leave cache refresh to the caller when private upload succeeds', async () => {
    driver.given.publicBody('wrong');

    await driver.when.create();

    expect(driver.get.checkedDelivery()).toEqual([]);
  });

  it('should verify delivery successfully when stale cache is refreshed after upload', async () => {
    driver.given.publicBody('wrong');
    await driver.when.create();
    driver.given.publicBody('hello');

    await expect(driver.when.verifyDelivery()).resolves.toBeUndefined();
  });

  it('should reject delivery verification when the stored object is missing', async () => {
    await expect(driver.when.verifyDelivery()).rejects.toThrow(
      'missing from storage',
    );
  });

  it('should reject authoritative inspection when stored metadata cannot be read', async () => {
    driver.given.object('present');
    driver.given.failure('metadata');

    await expect(driver.when.inspect()).rejects.toThrow('Storage unavailable');
  });
});
