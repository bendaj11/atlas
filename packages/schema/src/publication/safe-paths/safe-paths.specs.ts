import { faker } from '@faker-js/faker';
import { AtlasValidationError } from '../../errors/atlas-validation-error/atlas-validation-error.js';
import { SafePathsDriver } from './safe-paths.driver.js';

describe('assertSafeArtifactId', () => {
  let driver: SafePathsDriver;

  beforeEach(() => {
    driver = new SafePathsDriver();
  });

  it('should not throw when the id is a URL-safe segment', () => {
    expect(() =>
      driver.when.artifactIdAsserted(faker.string.uuid()),
    ).not.toThrow();
  });

  it('should throw with the default subject when the id could escape the storage prefix', () => {
    expect(() => driver.when.artifactIdAsserted('../orders')).toThrow(
      expect.objectContaining<Partial<AtlasValidationError>>({
        summary:
          'Invalid Atlas artifact id. artifact id: Expected artifact id "../orders" to be a URL-safe path segment.',
      }),
    );
  });

  it('should throw a non-empty string issue under the given subject when the id is not a string', () => {
    expect(() => driver.when.artifactIdAsserted(undefined, 'hostId')).toThrow(
      expect.objectContaining<Partial<AtlasValidationError>>({
        issues: [
          {
            path: 'hostId',
            message: 'Expected hostId to be a non-empty string.',
          },
        ],
      }),
    );
  });
});

describe('assertSafeRelativePath', () => {
  let driver: SafePathsDriver;

  beforeEach(() => {
    driver = new SafePathsDriver();
  });

  it('should not throw when the path is relative and safe', () => {
    expect(() =>
      driver.when.relativePathAsserted('assets/app.js', 'files.path'),
    ).not.toThrow();
  });

  it.each([
    'assets/app%2Fsecret.js',
    'entry.js?debug',
    'entry.js#fragment',
    '../up.js',
  ])(
    'should throw a safe relative path issue when the path is "%s"',
    (value) => {
      expect(() =>
        driver.when.relativePathAsserted(value, 'files.path'),
      ).toThrow(
        expect.objectContaining<Partial<AtlasValidationError>>({
          issues: [
            {
              path: 'files.path',
              message: `Expected "${value}" to be a safe relative path.`,
            },
          ],
        }),
      );
    },
  );
});
