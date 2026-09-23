import { faker } from '@faker-js/faker';
import { AtlasRuntimeError } from '../shared/errors.js';
import { ResilienceDriver } from './resilience.driver.js';
import { AtlasLoadError } from './resilience.errors.js';

describe('runResiliently', () => {
  let driver: ResilienceDriver;

  beforeEach(() => {
    driver = new ResilienceDriver();
  });

  it('should return the operation result when the operation succeeds', async () => {
    const value = faker.word.noun();
    await driver.given.operationResults([value]).when.run();

    expect(driver.get.result()).toBe(value);
  });

  it('should return the operation result when the legacy positional arguments are used', async () => {
    const value = faker.word.noun();
    await driver.given.operationResults([value]).when.runWithLegacyArguments();

    expect(driver.get.result()).toBe(value);
  });

  it('should return the operation result when the observer throws', async () => {
    const value = faker.word.noun();
    await driver.given
      .observerThrowing()
      .given.operationResults([value])
      .when.run();

    expect(driver.get.result()).toBe(value);
  });

  describe('when one retry is allowed and the first attempt fails with a retryable error', () => {
    beforeEach(async () => {
      await driver.given
        .policy({ retryCount: 1, timeoutMs: 50 })
        .given.operationResults([new Error('temporary outage'), 'ready'])
        .when.run();
    });

    it('should return the second attempt result when run', () => {
      expect(driver.get.result()).toBe('ready');
    });

    it('should emit a retry event followed by a success event when run', () => {
      expect(driver.get.eventTypes()).toEqual([
        'operation.retry',
        'operation.success',
      ]);
    });

    it('should report attempt numbers on the events when run', () => {
      expect(driver.get.eventAttempts()).toEqual([1, 2]);
    });
  });

  describe('when one retry is allowed and the operation hangs', () => {
    beforeEach(async () => {
      await driver.given
        .policy({ retryCount: 1, timeoutMs: 2 })
        .given.operationHanging()
        .when.run();
    });

    it('should reject with AtlasLoadError when both attempts time out', () => {
      expect(driver.get.error()).toBeInstanceOf(AtlasLoadError);
    });

    it('should abort the signal of every attempt when both attempts time out', () => {
      expect(driver.get.signals().map((signal) => signal.aborted)).toEqual([
        true,
        true,
      ]);
    });
  });

  describe('when one retry is allowed and every attempt fails', () => {
    const context = {
      stage: 'remote-module',
      resource: faker.internet.url(),
      appId: faker.string.uuid(),
      version: faker.system.semver(),
    };

    beforeEach(async () => {
      await driver.given
        .context(context)
        .given.policy({ retryCount: 1, timeoutMs: 50 })
        .given.operationResults([new Error('offline'), new Error('offline')])
        .when.run();
    });

    it('should reject with the operation context and attempt count when run', () => {
      expect(driver.get.error()).toMatchObject({
        stage: context.stage,
        appId: context.appId,
        version: context.version,
        attempts: 2,
        code: 'ATLAS_RESOURCE_LOAD_FAILED',
      });
    });

    it('should emit a retry event followed by an error event when run', () => {
      expect(driver.get.eventTypes()).toEqual([
        'operation.retry',
        'operation.error',
      ]);
    });
  });

  describe('when retries are allowed and the first attempt fails with a non-retryable error', () => {
    const failure = new AtlasRuntimeError('HTTP 404', {
      suggestedActions: 'Deploy the asset.',
      code: 'ATLAS_RESOURCE_HTTP_ERROR',
      retryable: false,
    });

    beforeEach(async () => {
      await driver.given
        .policy({ retryCount: 3, timeoutMs: 50 })
        .given.operationResults([failure])
        .when.run();
    });

    it('should call the operation once when run', () => {
      expect(driver.get.operationMock()).toHaveBeenCalledTimes(1);
    });

    it('should reject with the cause suggested actions when run', () => {
      expect(driver.get.error()).toMatchObject({
        suggestedActions: ['Deploy the asset.'],
        cause: failure,
      });
    });
  });

  it('should reject with ATLAS_INVALID_TIMEOUT when timeoutMs is not a positive integer', async () => {
    await driver.given.policy({ timeoutMs: 0 }).when.run();

    expect(driver.get.error()).toMatchObject({ code: 'ATLAS_INVALID_TIMEOUT' });
  });

  it('should reject with ATLAS_INVALID_RETRY_COUNT when retryCount is negative', async () => {
    await driver.given.policy({ retryCount: -1 }).when.run();

    expect(driver.get.error()).toMatchObject({
      code: 'ATLAS_INVALID_RETRY_COUNT',
    });
  });
});
