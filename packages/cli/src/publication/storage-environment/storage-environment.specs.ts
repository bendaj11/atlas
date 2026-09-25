import { faker } from '@faker-js/faker';
import { StorageEnvironmentDriver } from './storage-environment.driver.js';

describe('storage-environment', () => {
  let driver: StorageEnvironmentDriver;

  beforeEach(() => {
    driver = new StorageEnvironmentDriver();
  });

  describe('selectStorageFromEnvironment', () => {
    it('should return undefined when neither a provider nor a bucket is configured', () => {
      expect(driver.get.selection()).toBeUndefined();
    });

    it('should select artifactory when ATLAS_STORAGE names it', () => {
      driver.given.environment({ ATLAS_STORAGE: 'artifactory' });

      expect(driver.get.selection()).toStrictEqual({ provider: 'artifactory' });
    });

    it('should infer S3 with defaults when only a bucket is configured', () => {
      const bucket = faker.word.noun();
      driver.given.environment({ ATLAS_S3_BUCKET: bucket });

      expect(driver.get.selection()).toStrictEqual({
        provider: 's3',
        s3Options: {
          bucket,
          region: 'us-east-1',
          forcePathStyle: undefined,
          lockMode: 's3',
        },
      });
    });

    it('should prefer flags over environment when both are given', () => {
      driver.given
        .environment({
          ATLAS_S3_BUCKET: 'env-bucket',
          ATLAS_S3_REGION: 'eu-west-1',
        })
        .given.flags([
          '--bucket=flag-bucket',
          '--region=us-west-2',
          '--key-prefix=p',
        ]);

      expect(driver.get.selection()).toMatchObject({
        s3Options: { bucket: 'flag-bucket', region: 'us-west-2', prefix: 'p' },
      });
    });

    it('should include static credentials when both keys are set', () => {
      driver.given.environment({
        ATLAS_S3_BUCKET: 'b',
        ATLAS_STORAGE_ACCESS_KEY_ID: 'id',
        ATLAS_STORAGE_SECRET_ACCESS_KEY: 'secret',
        ATLAS_STORAGE_SESSION_TOKEN: 'token',
      });

      expect(driver.get.selection()).toMatchObject({
        s3Options: {
          accessKeyId: 'id',
          secretAccessKey: 'secret',
          sessionToken: 'token',
        },
      });
    });

    it('should throw when only one credential key is set', () => {
      driver.given.environment({
        ATLAS_S3_BUCKET: 'b',
        ATLAS_STORAGE_ACCESS_KEY_ID: 'id',
      });

      expect(() => driver.get.selection()).toThrow(
        'ATLAS_STORAGE_ACCESS_KEY_ID and ATLAS_STORAGE_SECRET_ACCESS_KEY must be set together.',
      );
    });

    it('should throw when the provider is unknown', () => {
      driver.given.environment({ ATLAS_STORAGE: 'gcs' });

      expect(() => driver.get.selection()).toThrow(
        'Unsupported storage provider "gcs". Use s3 or artifactory.',
      );
    });

    it('should throw when S3 is selected without a bucket', () => {
      driver.given.environment({ ATLAS_STORAGE: 's3' });

      expect(() => driver.get.selection()).toThrow(
        'ATLAS_S3_BUCKET is required when ATLAS_STORAGE=s3.',
      );
    });

    it('should throw when ATLAS_S3_FORCE_PATH_STYLE is not a boolean', () => {
      driver.given.environment({
        ATLAS_S3_BUCKET: 'b',
        ATLAS_S3_FORCE_PATH_STYLE: 'yes',
      });

      expect(() => driver.get.selection()).toThrow(
        'ATLAS_S3_FORCE_PATH_STYLE must be "true" or "false".',
      );
    });

    it('should throw when ATLAS_S3_LOCK_MODE is unsupported', () => {
      driver.given.environment({
        ATLAS_S3_BUCKET: 'b',
        ATLAS_S3_LOCK_MODE: 'redis',
      });

      expect(() => driver.get.selection()).toThrow(
        'ATLAS_S3_LOCK_MODE must be "s3" or "external".',
      );
    });
  });

  describe('requiredStorageValue', () => {
    it('should prefer the flag when both flag and variable are set', () => {
      driver.given
        .environment({ ATLAS_TEST_REQUIRED: 'env' })
        .given.flags(['--repo=flag']);

      expect(driver.get.requiredValue('repo', 'ATLAS_TEST_REQUIRED')).toBe(
        'flag',
      );
    });

    it('should throw naming both sources when neither is set', () => {
      expect(() =>
        driver.get.requiredValue('repo', 'ATLAS_TEST_REQUIRED'),
      ).toThrow(
        'ATLAS_TEST_REQUIRED (or --repo) is required for Artifactory storage.',
      );
    });
  });

  describe('positiveEnvironmentInteger', () => {
    it('should return undefined when the variable is unset', () => {
      expect(driver.get.positiveInteger('ATLAS_TEST_LIMIT')).toBeUndefined();
    });

    it('should parse the variable when it is a positive integer', () => {
      driver.given.environment({ ATLAS_TEST_LIMIT: '42' });

      expect(driver.get.positiveInteger('ATLAS_TEST_LIMIT')).toBe(42);
    });

    it.each(['0', '-1', '1.5', 'ten'])(
      'should throw when the variable is %s',
      (value) => {
        driver.given.environment({ ATLAS_TEST_LIMIT: value });

        expect(() => driver.get.positiveInteger('ATLAS_TEST_LIMIT')).toThrow(
          'ATLAS_TEST_LIMIT must be a positive safe integer.',
        );
      },
    );
  });

  describe('resolveParallelUploads', () => {
    it('should default to sixteen parallel uploads when nothing is configured', () => {
      expect(driver.get.concurrency()).toBe(16);
    });

    it('should read ATLAS_PARALLEL_UPLOADS when the flag is absent', () => {
      driver.given.environment({ ATLAS_PARALLEL_UPLOADS: '16' });

      expect(driver.get.concurrency()).toBe(16);
    });

    it('should prefer --parallel-uploads over ATLAS_PARALLEL_UPLOADS when both are set', () => {
      driver.given
        .environment({ ATLAS_PARALLEL_UPLOADS: '16' })
        .given.flags(['--parallel-uploads', '2']);

      expect(driver.get.concurrency()).toBe(2);
    });

    it.each(['0', '-1', '1.5', 'true'])(
      'should throw when --parallel-uploads is %s',
      (value) => {
        driver.given.flags([`--parallel-uploads=${value}`]);

        expect(() => driver.get.concurrency()).toThrow(
          '--parallel-uploads must be a positive integer.',
        );
      },
    );

    it('should name the variable when ATLAS_PARALLEL_UPLOADS is invalid', () => {
      driver.given.environment({ ATLAS_PARALLEL_UPLOADS: 'many' });

      expect(() => driver.get.concurrency()).toThrow(
        'ATLAS_PARALLEL_UPLOADS must be a positive integer.',
      );
    });
  });
});
