import { StaticRegistryValidationDriver } from './static-registry-validation.driver.js';

describe('static registry validation', () => {
  let driver: StaticRegistryValidationDriver;

  beforeEach(() => {
    driver = new StaticRegistryValidationDriver();
  });

  it('should accept registry when content revision is valid', () => {
    expect(() => driver.when.validated()).not.toThrow();
  });

  it('should reject registry when content revision is stale', () => {
    driver.given.revision(`sha256:${'0'.repeat(64)}`);

    expect(() => driver.when.validated()).toThrow(/revision is invalid/);
  });
});
