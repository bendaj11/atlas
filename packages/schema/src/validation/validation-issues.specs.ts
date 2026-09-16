import { faker } from '@faker-js/faker';
import { ValidationIssuesDriver } from './validation-issues.driver.js';

describe('ValidationIssues', () => {
  let driver: ValidationIssuesDriver;

  beforeEach(() => {
    driver = new ValidationIssuesDriver();
  });

  describe('when created without prefix', () => {
    beforeEach(() => {
      driver.given.prefix(undefined).when.created();
    });

    it('should list nothing when nothing was added', () => {
      expect(driver.get.list()).toEqual([]);
    });

    it('should list the issue with its own path when added', () => {
      const issue = {
        path: faker.lorem.word(),
        message: faker.lorem.sentence(),
      };
      driver.when.added(issue);

      expect(driver.get.list()).toEqual([issue]);
    });

    it('should prefix the path with the scope when added through a scope', () => {
      const scope = faker.lorem.word();
      const issue = {
        path: faker.lorem.word(),
        message: faker.lorem.sentence(),
      };
      driver.when.addedAt(scope, issue);

      expect(driver.get.list()).toEqual([
        { path: `${scope}.${issue.path}`, message: issue.message },
      ]);
    });

    it('should use the scope alone as path when added through a scope with an empty path', () => {
      const scope = faker.lorem.word();
      const message = faker.lorem.sentence();
      driver.when.addedAt(scope, { path: '', message });

      expect(driver.get.list()).toEqual([{ path: scope, message }]);
    });
  });

  describe('when created with a prefix', () => {
    const prefix = 'apps.0';

    beforeEach(() => {
      driver.given.prefix(prefix).when.created();
    });

    it('should prefix the path when added', () => {
      const issue = {
        path: faker.lorem.word(),
        message: faker.lorem.sentence(),
      };
      driver.when.added(issue);

      expect(driver.get.list()).toEqual([
        { path: `${prefix}.${issue.path}`, message: issue.message },
      ]);
    });

    it('should chain prefix and scope when added through a scope', () => {
      const scope = faker.lorem.word();
      const issue = {
        path: faker.lorem.word(),
        message: faker.lorem.sentence(),
      };
      driver.when.addedAt(scope, issue);

      expect(driver.get.list()).toEqual([
        { path: `${prefix}.${scope}.${issue.path}`, message: issue.message },
      ]);
    });
  });
});
