import { faker } from '@faker-js/faker';
import { ValidateReleaseMetadataDriver } from './validate-release-metadata.driver.js';

describe('validateReleaseMetadata', () => {
  let driver: ValidateReleaseMetadataDriver;

  beforeEach(() => {
    driver = new ValidateReleaseMetadataDriver();
  });

  it('should report nothing when the record is undefined', () => {
    driver.when.validated(undefined);

    expect(driver.get.issues()).toEqual([]);
  });

  it('should report nothing when git fields fit their limits and prNumber is positive', () => {
    driver.when.validated({
      gitSha: faker.git.commitSha(),
      gitBranch: faker.git.branch(),
      gitCommitTitle: faker.git.commitMessage(),
      prNumber: faker.number.int({ min: 1, max: 9999 }),
    });

    expect(driver.get.issues()).toEqual([]);
  });

  it.each([
    ['gitSha', 255],
    ['gitBranch', 255],
    ['gitCommitTitle', 500],
  ])('should report %s when it exceeds %i characters', (field, limit) => {
    driver.when.validated({ [field]: 'a'.repeat(limit + 1) });

    expect(driver.get.issues()).toEqual([
      {
        path: field,
        message: `Expected a non-empty string no longer than ${limit} characters.`,
      },
    ]);
  });

  it.each([0, -3, 1.5, '12'])(
    'should report prNumber when it is %j',
    (prNumber) => {
      driver.when.validated({ prNumber });

      expect(driver.get.issues()).toEqual([
        {
          path: 'prNumber',
          message:
            'Expected pull request number to be an integer of at least 1.',
        },
      ]);
    },
  );
});
