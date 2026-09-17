import { faker } from '@faker-js/faker';
import { AtlasError } from '@atlas/schema';
import { DescribeFatalErrorDriver } from './describe-fatal-error.driver.js';

describe('describeFatalError', () => {
  let driver: DescribeFatalErrorDriver;

  beforeEach(() => {
    driver = new DescribeFatalErrorDriver();
  });

  describe('when the error is an Atlas error', () => {
    const summary = faker.lorem.sentence();
    const code = faker.string.alpha({ length: 8, casing: 'upper' });
    const actions = [faker.lorem.sentence(), faker.lorem.sentence()];
    const error = new AtlasError(summary, { code, suggestedActions: actions });

    beforeEach(() => {
      driver.when.described(error);
    });

    it('should describe the failure from the error fields when described', () => {
      expect(driver.get.failure()).toEqual({
        message: `Atlas could not start this page: ${summary}`,
        suggestedActions: actions,
        code,
        cause: error,
      });
    });

    it('should not fall back to message matching when described', () => {
      expect(driver.get.suggestedActionsForMock()).not.toHaveBeenCalled();
    });
  });

  it('should use the fallback code when the Atlas error has none', () => {
    driver.when.described(
      new AtlasError(faker.lorem.sentence(), {
        suggestedActions: faker.lorem.sentence(),
      }),
    );

    expect(driver.get.failure().code).toBe('ATLAS_BOOTSTRAP_FAILED');
  });

  describe('when the error is a plain error', () => {
    const actions = [faker.lorem.sentence()];

    beforeEach(() => {
      driver.given.fallbackActions(actions);
    });

    it('should describe the failure from the message and matched actions when described', () => {
      const detail = faker.lorem.sentence();
      const error = new Error(detail);
      driver.when.described(error);

      expect(driver.get.failure()).toEqual({
        message: `Atlas could not start this page: ${detail}`,
        suggestedActions: actions,
        code: 'ATLAS_BOOTSTRAP_FAILED',
        cause: error,
      });
    });

    it('should strip a suggested actions suffix from the message when described', () => {
      const detail = faker.lorem.sentence();
      driver.when.described(new Error(`${detail} Suggested actions: 1) retry`));

      expect(driver.get.suggestedActionsForMock()).toHaveBeenCalledWith(detail);
    });

    it('should wrap a non-error value in an error when described', () => {
      const detail = faker.lorem.sentence();
      driver.when.described(detail);

      expect(driver.get.failure().cause).toEqual(new Error(detail));
    });
  });
});
