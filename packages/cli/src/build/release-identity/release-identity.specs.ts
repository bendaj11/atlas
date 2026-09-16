import { faker } from '@faker-js/faker';
import { aProject } from '../../workspace/workspace.testkit.js';
import { ReleaseIdentityDriver } from './release-identity.driver.js';

describe('release-identity', () => {
  let driver: ReleaseIdentityDriver;

  beforeEach(() => {
    driver = new ReleaseIdentityDriver();
  });

  describe('publicationIdentity', () => {
    it('should describe a release with git source when --version and git flags are given', () => {
      const version = faker.system.semver();
      const gitSha = faker.git.commitSha();
      const gitBranch = faker.git.branch();
      const gitCommitTitle = faker.git.commitMessage();
      driver.given.flags([
        `--version=${version}`,
        `--git-sha=${gitSha}`,
        `--git-branch=${gitBranch}`,
        `--git-commit-title=${gitCommitTitle}`,
      ]);

      expect(driver.get.publication()).toStrictEqual({
        release: { version },
        source: { gitSha, gitBranch, gitCommitTitle },
      });
    });

    it('should omit source when --version is given outside a git checkout', () => {
      const version = faker.system.semver();
      driver.given.flags([`--version=${version}`]);

      expect(driver.get.publication()).toStrictEqual({ release: { version } });
    });

    it.each(['pr', 'mr'])(
      'should describe a preview when --%s and --git-sha are given',
      (flag) => {
        const number = faker.number.int({ min: 1, max: 9999 });
        const gitSha = faker.git.commitSha();
        driver.given.flags([`--${flag}=${number}`, `--git-sha=${gitSha}`]);

        expect(driver.get.publication()).toStrictEqual({
          preview: { number, gitSha },
        });
      },
    );

    it('should throw when neither --version nor --pr is given', () => {
      driver.given.flags([]);

      expect(() => driver.get.publication()).toThrow(
        'Atlas publish requires exactly one of --version, --pr, or --mr.',
      );
    });

    it('should throw when both --version and --pr are given', () => {
      driver.given.flags([`--version=${faker.system.semver()}`, '--pr=1']);

      expect(() => driver.get.publication()).toThrow(
        'Atlas publish requires exactly one of --version, --pr, or --mr.',
      );
    });

    it('should throw when --pr is not a positive integer', () => {
      driver.given.flags(['--pr=0', `--git-sha=${faker.git.commitSha()}`]);

      expect(() => driver.get.publication()).toThrow(
        '--pr and --mr must be positive integers.',
      );
    });

    it('should throw when a preview has no git sha', () => {
      driver.given.flags(['--pr=7']);

      expect(() => driver.get.publication()).toThrow(
        'Preview publication requires the checked-out Git SHA or --git-sha.',
      );
    });

    it('should throw when --version is not a safe release segment', () => {
      driver.given.flags(['--version=release candidate']);

      expect(() => driver.get.publication()).toThrow(/release version/i);
    });
  });

  describe('releaseIdentity', () => {
    it('should default to production with the project version when no flags are given', () => {
      const project = aProject();
      driver.given.project(project).given.flags([]);

      expect(driver.get.release()).toStrictEqual({
        channel: 'production',
        version: project.version,
      });
    });

    it('should select the pr channel and suffix the version when --pr is given', () => {
      const number = faker.number.int({ min: 1, max: 9999 });
      driver.given
        .project(aProject({ version: '1.2.3-beta.1+build' }))
        .given.flags([`--pr=${number}`]);

      expect(driver.get.release()).toMatchObject({
        channel: 'pr',
        version: `1.2.3-pr.${number}`,
        prNumber: number,
      });
    });

    it('should honor an explicit --channel when given', () => {
      driver.given.flags(['--channel=local']);

      expect(driver.get.release().channel).toBe('local');
    });

    it('should honor ATLAS_CHANNEL when no --channel is given', () => {
      driver.given.environment({ ATLAS_CHANNEL: 'pr' }).given.flags([]);

      expect(driver.get.release().channel).toBe('pr');
    });

    it('should use --version over the project version when given', () => {
      const version = faker.system.semver();
      driver.given.flags([`--version=${version}`]);

      expect(driver.get.release().version).toBe(version);
    });

    it('should include git flags when they are given', () => {
      const gitSha = faker.git.commitSha();
      driver.given.flags([`--git-sha=${gitSha}`]);

      expect(driver.get.release().gitSha).toBe(gitSha);
    });

    it('should throw when --pr is not an integer', () => {
      driver.given.flags(['--pr=abc']);

      expect(() => driver.get.release()).toThrow(
        'Expected an integer, received "abc".',
      );
    });
  });
});
