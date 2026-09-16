import { anAppArtifactVersion } from '../../../types/app.testkit';
import { ArtifactVersionKeysDriver } from './artifact-version-keys.driver';

describe('uniqueVersions', () => {
  let driver: ArtifactVersionKeysDriver;

  beforeEach(() => {
    driver = new ArtifactVersionKeysDriver();
  });

  it('should keep input order when versions are distinct', () => {
    driver.given
      .version(
        anAppArtifactVersion({
          channel: 'production',
          version: '3.0.0',
          buildId: 'latest',
        }),
      )
      .given.version(
        anAppArtifactVersion({
          channel: 'production',
          version: '2.0.0',
          buildId: 'previous',
        }),
      )
      .given.version(
        anAppArtifactVersion({
          channel: 'production',
          version: '1.0.0',
          buildId: 'oldest',
        }),
      );

    expect(driver.get.uniqueVersionKeys()).toStrictEqual([
      'production:3.0.0:latest',
      'production:2.0.0:previous',
      'production:1.0.0:oldest',
    ]);
  });

  it('should keep the last occurrence position when a version repeats', () => {
    driver.given
      .version(
        anAppArtifactVersion({
          channel: 'production',
          version: '1.0.0',
          buildId: 'a',
        }),
      )
      .given.version(
        anAppArtifactVersion({
          channel: 'production',
          version: '2.0.0',
          buildId: 'b',
        }),
      )
      .given.version(
        anAppArtifactVersion({
          channel: 'production',
          version: '1.0.0',
          buildId: 'a',
        }),
      );

    expect(driver.get.uniqueVersionKeys()).toStrictEqual([
      'production:1.0.0:a',
      'production:2.0.0:b',
    ]);
  });
});

describe('versionKey', () => {
  let driver: ArtifactVersionKeysDriver;

  beforeEach(() => {
    driver = new ArtifactVersionKeysDriver();
  });

  it('should combine channel, version, and build id when channel is production', () => {
    expect(
      driver.get.versionKey(
        anAppArtifactVersion({
          channel: 'production',
          version: '1.2.3',
          buildId: 'b1',
        }),
      ),
    ).toBe('production:1.2.3:b1');
  });

  it('should use the PR number when channel is pr', () => {
    expect(
      driver.get.versionKey(
        anAppArtifactVersion({ channel: 'pr', prNumber: 42, buildId: 'b1' }),
      ),
    ).toBe('pr:42:b1');
  });

  it('should fall back to the version when a pr has no number', () => {
    expect(
      driver.get.versionKey(
        anAppArtifactVersion({
          channel: 'pr',
          version: '1.0.0-pr.9',
          buildId: 'b1',
        }),
      ),
    ).toBe('pr:1.0.0-pr.9:b1');
  });
});
