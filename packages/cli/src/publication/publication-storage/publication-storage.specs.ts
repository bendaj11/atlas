import { beforeEach, describe, expect, it } from '@jest/globals';
import { PublicationStorageDriver } from './publication-storage.driver.js';

describe('createPublicationStorage', () => {
  let driver: PublicationStorageDriver;

  beforeEach(() => {
    driver = new PublicationStorageDriver();
  });

  it('should select Artifactory without a config file when native variables are set', async () => {
    driver.given.nativeEnvironment({});

    await driver.when.create();

    expect(driver.get.artifactoryOptions()).toMatchObject(
      driver.get.expectedArtifactoryConfiguration(),
    );
  });

  it('should prefer CLI settings when Artifactory environment settings differ', async () => {
    driver.given.nativeEnvironment({ ATLAS_STORAGE: 's3' });
    driver.given.arguments([
      'publish',
      '--storage',
      'artifactory',
      '--storage-api-url',
      'https://private.example.invalid/custom/artifactory',
      '--repository',
      'cli-repository',
      '--key-prefix',
      'cli-prefix',
      '--registry-url',
      'https://public.example.invalid/cli-prefix',
      '--lock-resource',
      'cli-lock',
    ]);

    await driver.when.create();

    expect(driver.get.artifactoryOptions()).toMatchObject({
      url: 'https://private.example.invalid/custom/artifactory',
      repository: 'cli-repository',
      prefix: 'cli-prefix',
      publicUrl: 'https://public.example.invalid/cli-prefix',
    });
  });

  it('should use the CLI lock resource when the environment names a different lock', async () => {
    driver.given.nativeEnvironment({ ATLAS_PUBLICATION_LOCK: 'cli-lock' });
    driver.given.arguments(['publish', '--lock-resource', 'cli-lock']);
    await driver.when.create();

    await expect(driver.when.assertExternalLock()).resolves.toBeUndefined();
  });

  it('should ignore S3 configuration when Artifactory is selected', async () => {
    driver.given.nativeEnvironment({
      ATLAS_S3_BUCKET: 'unused',
      ATLAS_STORAGE_ACCESS_KEY_ID: 'unused',
      ATLAS_S3_LOCK_MODE: 'unsupported',
      ATLAS_S3_FORCE_PATH_STYLE: 'unsupported',
    });

    await driver.when.create();

    expect(driver.get.s3Options()).toBeUndefined();
  });

  it.each([
    'ATLAS_STORAGE_API_URL',
    'ATLAS_ARTIFACTORY_REPOSITORY',
    'ATLAS_ARTIFACTORY_ACCESS_TOKEN',
    'ATLAS_REGISTRY_URL',
    'ATLAS_ARTIFACTORY_LOCK_RESOURCE',
  ])('should reject configuration when %s is missing', async (name) => {
    driver.given.nativeEnvironment({ [name]: undefined });

    await expect(driver.when.create()).rejects.toThrow(name);
  });

  it('should reject blank lock configuration when no resource is named', async () => {
    driver.given.nativeEnvironment({ ATLAS_ARTIFACTORY_LOCK_RESOURCE: ' ' });

    await expect(driver.when.create()).rejects.toThrow(
      'ATLAS_ARTIFACTORY_LOCK_RESOURCE',
    );
  });

  it('should reject token flags when no token environment variable is configured', async () => {
    driver.given.nativeEnvironment({
      ATLAS_ARTIFACTORY_ACCESS_TOKEN: undefined,
    });
    driver.given.arguments(['publish', '--access-token', 'not-supported']);

    await expect(driver.when.create()).rejects.toThrow(
      'ATLAS_ARTIFACTORY_ACCESS_TOKEN',
    );
  });

  it('should allow read-only setup when the external lock is not held', async () => {
    driver.given.nativeEnvironment({});

    await expect(driver.when.create()).resolves.toBeUndefined();
  });

  it.each([undefined, 'another-lock'])(
    'should reject writes when the held lock marker is %s',
    async (marker) => {
      driver.given.nativeEnvironment({ ATLAS_PUBLICATION_LOCK: marker });
      await driver.when.create();

      await expect(driver.when.assertExternalLock()).rejects.toThrow(
        'shared external lock',
      );
    },
  );

  it('should allow writes when the configured shared lock marker matches', async () => {
    driver.given.nativeEnvironment({
      ATLAS_PUBLICATION_LOCK: driver.get.lockResource(),
    });
    await driver.when.create();

    await expect(driver.when.assertExternalLock()).resolves.toBeUndefined();
  });

  it('should reject subsequent writes when the lock marker disappears', async () => {
    driver.given.nativeEnvironment({});
    await driver.when.create();

    await expect(driver.when.loseExternalLock()).rejects.toThrow(
      'shared external lock',
    );
  });

  it('should verify target delivery when deploying between separate registries', async () => {
    driver.given.nativeEnvironment({ ATLAS_REGISTRY_URL: undefined });
    driver.given.arguments([
      'deploy',
      '--source-registry-url',
      'https://source.example.invalid/atlas',
      '--target-registry-url',
      'https://target.example.invalid/atlas',
    ]);

    await driver.when.create();

    expect(driver.get.artifactoryOptions().publicUrl).toBe(
      'https://target.example.invalid/atlas',
    );
  });

  it('should use target environment settings when deploy flags are absent', async () => {
    driver.given.nativeEnvironment({
      ATLAS_REGISTRY_URL: undefined,
      ATLAS_SOURCE_REGISTRY_URL: 'https://source.example.invalid/atlas',
      ATLAS_TARGET_REGISTRY_URL: 'https://target.example.invalid/atlas',
    });
    driver.given.arguments(['deploy']);

    await driver.when.create();

    expect(driver.get.artifactoryOptions().publicUrl).toBe(
      'https://target.example.invalid/atlas',
    );
  });

  it('should prefer the target flag when deploy target environment settings differ', async () => {
    driver.given.nativeEnvironment({
      ATLAS_TARGET_REGISTRY_URL: 'https://unused.example.invalid/atlas',
    });
    driver.given.arguments([
      'deploy',
      '--target-registry-url',
      'https://target.example.invalid/atlas',
    ]);

    await driver.when.create();

    expect(driver.get.artifactoryOptions().publicUrl).toBe(
      'https://target.example.invalid/atlas',
    );
  });

  it.each(['publish', 'remove-preview', 'prune-previews'])(
    'should ignore deploy target variables when running %s',
    async (command) => {
      driver.given.nativeEnvironment({
        ATLAS_TARGET_REGISTRY_URL: 'https://unused.example.invalid/atlas',
      });
      driver.given.arguments([command]);

      await driver.when.create();

      expect(driver.get.artifactoryOptions().publicUrl).toBe(
        driver.get.expectedArtifactoryConfiguration().publicUrl,
      );
    },
  );

  it('should pass operational limits when Artifactory limit variables are configured', async () => {
    driver.given.nativeEnvironment({
      ATLAS_ARTIFACTORY_REQUEST_TIMEOUT_MS: '120000',
      ATLAS_ARTIFACTORY_MAX_BUFFERED_BYTES: '536870912',
    });

    await driver.when.create();

    expect(driver.get.artifactoryOptions()).toMatchObject({
      requestTimeoutMs: 120000,
      maxBufferedBytes: 536870912,
    });
  });

  it.each(['0', '-1', '1.5', 'NaN', '', '9007199254740992'])(
    'should reject configuration when request timeout is %s',
    async (value) => {
      driver.given.nativeEnvironment({
        ATLAS_ARTIFACTORY_REQUEST_TIMEOUT_MS: value,
      });

      await expect(driver.when.create()).rejects.toThrow(
        'ATLAS_ARTIFACTORY_REQUEST_TIMEOUT_MS must be a positive safe integer',
      );
    },
  );

  it('should reject configuration when the buffer limit is invalid', async () => {
    driver.given.nativeEnvironment({
      ATLAS_ARTIFACTORY_MAX_BUFFERED_BYTES: '0',
    });

    await expect(driver.when.create()).rejects.toThrow(
      'ATLAS_ARTIFACTORY_MAX_BUFFERED_BYTES must be a positive safe integer',
    );
  });

  it('should infer S3 when only a bucket is configured', async () => {
    driver.given.variables({ ATLAS_S3_BUCKET: 'implicit-s3' });

    await driver.when.create();

    expect(driver.get.s3Options()).toMatchObject({
      bucket: 'implicit-s3',
      region: 'us-east-1',
      lockMode: 's3',
    });
  });

  it('should select S3 when the CLI overrides an Artifactory provider variable', async () => {
    driver.given.nativeEnvironment({});
    driver.given.arguments([
      'publish',
      '--storage',
      's3',
      '--bucket',
      'cli-bucket',
      '--storage-api-url',
      'https://s3.example.invalid',
      '--region',
      'eu-west-1',
    ]);

    await driver.when.create();

    expect(driver.get.s3Options()).toMatchObject({
      bucket: 'cli-bucket',
      endpoint: 'https://s3.example.invalid',
      region: 'eu-west-1',
    });
  });

  it('should explain provider choices when storage is not configured', async () => {
    await expect(driver.when.create()).rejects.toThrow('--storage artifactory');
  });

  it('should reject unknown providers when selected explicitly', async () => {
    driver.given.arguments(['publish', '--storage', 'unsupported']);

    await expect(driver.when.create()).rejects.toThrow('Use s3 or artifactory');
  });

  it.each(['object', 'factory'] as const)(
    'should prefer custom storage when a configured %s exists',
    async (kind) => {
      driver.given.variables({ ATLAS_STORAGE: 'unsupported' });
      driver.given.customStorage(kind);

      await driver.when.create();

      expect(driver.get.configuredStorageUsed()).toBe(true);
    },
  );

  it('should reject custom storage when its contract is incomplete', async () => {
    driver.given.customStorage('invalid');

    await expect(driver.when.create()).rejects.toThrow(
      'must implement AtlasPublicationStorage',
    );
  });

  it('should reject custom storage when its optional delivery verifier is not callable', async () => {
    driver.given.customStorage('invalid-delivery');

    await expect(driver.when.create()).rejects.toThrow(
      'must implement AtlasPublicationStorage',
    );
  });

  it('should propagate errors when custom storage creation rejects', async () => {
    driver.given.customStorage('rejecting');

    await expect(driver.when.create()).rejects.toThrow(
      'Custom storage unavailable',
    );
  });

  it('should reject storage configuration when secret access key is missing', async () => {
    driver.given.environment({ secretAccessKey: 'missing' });

    await expect(driver.when.create()).rejects.toThrow(
      'ATLAS_STORAGE_ACCESS_KEY_ID and ATLAS_STORAGE_SECRET_ACCESS_KEY must be set together.',
    );
  });

  it('should use external lease when external locking is configured', async () => {
    driver.given.environment({ lockMode: 'external' });

    await driver.when.acquireExternalLock();

    expect(driver.get.externalLockIsUsable()).toBe(true);
  });

  it('should reject storage configuration when lock mode is unsupported', async () => {
    driver.given.environment({ lockMode: 'unsupported' });

    await expect(driver.when.create()).rejects.toThrow(
      'ATLAS_S3_LOCK_MODE must be "s3" or "external".',
    );
  });

  it('should use create-only condition when immutable object is written', async () => {
    await driver.when.createImmutableObject();

    expect(driver.get.latestPutCondition()).toStrictEqual({
      ifNoneMatch: '*',
    });
  });

  it('should use version condition when mutable object is replaced', async () => {
    await driver.when.replaceMutableObject();

    expect(driver.get.latestPutCondition()).toStrictEqual({
      ifMatch: 'etag-1',
    });
  });
});
