import { AtlasValidationError } from '../../errors/atlas-validation-error/atlas-validation-error.js';
import { ReleaseVersionDriver } from './release-version.driver.js';

const UNSAFE_VERSIONS = [
  '.1',
  '-1',
  '_1',
  '~1',
  '1/2',
  '1+build',
  '1%20build',
  'rélease',
];

describe('assertReleaseVersion', () => {
  let driver: ReleaseVersionDriver;

  beforeEach(() => {
    driver = new ReleaseVersionDriver();
  });

  it('should not throw when the version uses RFC 3986 unreserved characters', () => {
    expect(() => driver.when.asserted('Release_1.2~candidate-3')).not.toThrow();
  });

  it.each(['', 3, undefined])(
    'should throw a non-empty string issue when the version is %j',
    (value) => {
      expect(() => driver.when.asserted(value)).toThrow(
        expect.objectContaining<Partial<AtlasValidationError>>({
          issues: [
            {
              path: 'release.version',
              message: 'Expected release version to be a non-empty string.',
            },
          ],
        }),
      );
    },
  );

  it('should throw a reserved issue when the version is latest', () => {
    expect(() => driver.when.asserted('latest')).toThrow(
      expect.objectContaining<Partial<AtlasValidationError>>({
        issues: [
          {
            path: 'release.version',
            message:
              'Expected release version to be a concrete version, "latest" is reserved.',
          },
        ],
      }),
    );
  });

  it.each(UNSAFE_VERSIONS)(
    'should throw a URL-safe issue when the version is "%s"',
    (value) => {
      expect(() => driver.when.asserted(value)).toThrow(
        expect.objectContaining<Partial<AtlasValidationError>>({
          issues: [
            {
              path: 'release.version',
              message: `Expected release version "${value}" to be a URL-safe path segment.`,
            },
          ],
        }),
      );
    },
  );
});
