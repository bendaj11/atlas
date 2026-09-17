import { faker } from '@faker-js/faker';
import type { AtlasValidationError } from '../errors/atlas-validation-error/atlas-validation-error.js';
import { AssertValidDriver } from './assert-valid.driver.js';

describe('assertNoIssues', () => {
  let driver: AssertValidDriver;

  beforeEach(() => {
    driver = new AssertValidDriver();
  });

  it('should not throw when no issues were collected', () => {
    expect(() => driver.when.asserted(faker.lorem.sentence())).not.toThrow();
  });

  it('should throw AtlasValidationError carrying the issues when issues were collected', () => {
    const issue = { path: faker.lorem.word(), message: faker.lorem.sentence() };
    driver.given.issue(issue);

    expect(() => driver.when.asserted(faker.lorem.sentence())).toThrow(
      expect.objectContaining<Partial<AtlasValidationError>>({
        issues: [issue],
      }),
    );
  });
});
