import { faker } from '@faker-js/faker';
import { anAppManifest } from '@atlas/testkit';
import { uniqueVersions, versionKey } from './artifact-version-keys';

describe('uniqueVersions', () => {
  it('should keep input order when versions are distinct', () => {
    const versions = [anAppManifest(), anAppManifest(), anAppManifest()];

    expect(uniqueVersions(versions)).toStrictEqual(versions);
  });

  it('should drop the later occurrence when a version repeats', () => {
    const repeated = anAppManifest();
    const other = anAppManifest();

    expect(uniqueVersions([repeated, other, repeated])).toStrictEqual([
      repeated,
      other,
    ]);
  });
});

describe('versionKey', () => {
  it('should combine channel, version, and build id when channel is not pr', () => {
    const version = anAppManifest({ channel: 'production' });

    expect(versionKey(version)).toBe(
      `production:${version.version}:${version.buildId}`,
    );
  });

  it('should use the pr number when channel is pr and a pr number exists', () => {
    const version = anAppManifest({
      channel: 'pr',
      prNumber: faker.number.int(),
    });

    expect(versionKey(version)).toBe(
      `pr:${version.prNumber}:${version.buildId}`,
    );
  });

  it('should fall back to the version when channel is pr and no pr number exists', () => {
    const version = anAppManifest({ channel: 'pr', prNumber: undefined });

    expect(versionKey(version)).toBe(
      `pr:${version.version}:${version.buildId}`,
    );
  });
});
