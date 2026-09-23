import { faker } from '@faker-js/faker';
import {
  aHostManifest,
  anAppManifest,
  anExportedWidgetManifest,
  aRoutePlacement,
} from '@atlas/testkit';
import {
  baseUrlFromRemoteEntry,
  createCustomArtifactVersion,
  isArtifactVersionSupportedByHost,
  normalizeStoredArtifactVersion,
  versionBuildIdLabel,
  versionLabel,
} from './artifact-version-utils';

describe('createCustomArtifactVersion', () => {
  it('should build a local manifest when the raw url is a base url', () => {
    expect(
      createCustomArtifactVersion({
        deployedArtifactVersion: anAppManifest({ framework: 'react' }),
        rawUrl: 'http://localhost:4201/',
      }),
    ).toMatchObject({
      channel: 'local',
      version: '0.0.0-local',
      buildId: 'custom-url',
      remoteEntryUrl: 'http://localhost:4201/remoteEntry.json',
      styles: [],
    });
  });

  it('should add a local stylesheet when the deployed app is angular', () => {
    expect(
      createCustomArtifactVersion({
        deployedArtifactVersion: anAppManifest({ framework: 'angular' }),
        rawUrl: 'http://localhost:4201',
      }).styles,
    ).toStrictEqual([{ href: 'http://localhost:4201/styles.css' }]);
  });

  it('should drop the integrity when the deployed version has one', () => {
    expect(
      createCustomArtifactVersion({
        deployedArtifactVersion: anAppManifest({
          integrity: faker.string.alphanumeric(16),
        }),
        rawUrl: 'http://localhost:4201',
      }).integrity,
    ).toBeUndefined();
  });

  it('should point exported widgets at the local entry when the deployed app exports widgets', () => {
    const widget = anExportedWidgetManifest();

    expect(
      createCustomArtifactVersion({
        deployedArtifactVersion: anAppManifest({ exportedWidgets: [widget] }),
        rawUrl: 'http://localhost:4201',
      }),
    ).toMatchObject({
      exportedWidgets: [
        { ...widget, remoteEntryUrl: 'http://localhost:4201/remoteEntry.json' },
      ],
    });
  });

  it.each([
    'http://127.0.0.1:4201/remoteEntry.json',
    'http://localhost:4201/remoteEntry.json',
  ])('should keep the remote entry url when the raw url is %s', (url) => {
    expect(
      createCustomArtifactVersion({
        deployedArtifactVersion: anAppManifest(),
        rawUrl: url,
      }).remoteEntryUrl,
    ).toBe(url);
  });

  it.each([
    ['', 'Enter base URL.'],
    ['not a url', 'Base URL must be absolute HTTP URL.'],
    ['ftp://localhost/app', 'Base URL must be absolute HTTP URL.'],
    [
      'https://cdn.example/app',
      'Base URL must use localhost, 127.0.0.1, or [::1].',
    ],
    [
      'http://user:secret@localhost/app',
      'Base URL must not include credentials.',
    ],
    [
      'http://localhost/app?debug=true',
      'Base URL must not include query parameters or a fragment.',
    ],
    [
      'http://localhost/app#debug',
      'Base URL must not include query parameters or a fragment.',
    ],
  ])('should throw when the raw url is %s', (url, message) => {
    expect(() =>
      createCustomArtifactVersion({
        deployedArtifactVersion: anAppManifest(),
        rawUrl: url,
      }),
    ).toThrow(message);
  });
});

describe('baseUrlFromRemoteEntry', () => {
  it('should strip the remote entry file name when the url ends with it', () => {
    expect(
      baseUrlFromRemoteEntry('http://localhost:4201/app/remoteEntry.json'),
    ).toBe('http://localhost:4201/app');
  });

  it('should strip the trailing slash when the url ends with one', () => {
    expect(baseUrlFromRemoteEntry('http://localhost:4201/app/')).toBe(
      'http://localhost:4201/app',
    );
  });
});

describe('normalizeStoredArtifactVersion', () => {
  it('should restore the local version when a local manifest stored the custom build id as version', () => {
    const manifest = anAppManifest({ channel: 'local', version: 'custom-url' });

    expect(normalizeStoredArtifactVersion(manifest)).toStrictEqual({
      ...manifest,
      version: '0.0.0-local',
    });
  });

  it('should keep the manifest when it is not a local manifest', () => {
    const manifest = anAppManifest({ channel: 'production' });

    expect(normalizeStoredArtifactVersion(manifest)).toBe(manifest);
  });

  it('should keep the manifest when a local manifest has another version', () => {
    const manifest = anAppManifest({ channel: 'local' });

    expect(normalizeStoredArtifactVersion(manifest)).toBe(manifest);
  });
});

describe('versionLabel', () => {
  it('should join version, build id, and commit title when the channel is production', () => {
    const manifest = anAppManifest({
      channel: 'production',
      gitCommitTitle: faker.git.commitMessage(),
    });

    expect(versionLabel(manifest)).toBe(
      `${manifest.version}-${manifest.buildId} · ${manifest.gitCommitTitle}`,
    );
  });

  it('should show only the version when the channel is production, the build is canonical, and the title is punctuation', () => {
    const manifest = anAppManifest({
      channel: 'production',
      buildId: 'canonical',
      gitCommitTitle: '.',
    });

    expect(versionLabel(manifest)).toBe(manifest.version);
  });

  it('should show pr number, branch, short sha, and title when the channel is pr', () => {
    const manifest = anAppManifest({
      channel: 'pr',
      prNumber: faker.number.int(),
      gitBranch: faker.git.branch(),
      gitSha: faker.git.commitSha(),
      gitCommitTitle: faker.git.commitMessage(),
    });

    expect(versionLabel(manifest)).toBe(
      `PR #${manifest.prNumber} · ${manifest.gitBranch} · ${manifest.gitSha?.slice(0, 7)} · ${manifest.gitCommitTitle}`,
    );
  });

  it('should fall back to the pr number when the channel is pr and no metadata exists', () => {
    const manifest = anAppManifest({
      channel: 'pr',
      prNumber: faker.number.int(),
      gitBranch: undefined,
      gitSha: undefined,
      gitCommitTitle: undefined,
    });

    expect(versionLabel(manifest)).toBe(`PR #${manifest.prNumber}`);
  });

  it('should fall back to the version when the channel is pr and no pr number exists', () => {
    const manifest = anAppManifest({
      channel: 'pr',
      prNumber: undefined,
      gitBranch: undefined,
      gitSha: undefined,
      gitCommitTitle: undefined,
    });

    expect(versionLabel(manifest)).toBe(`PR #${manifest.version}`);
  });

  it('should show version, short build id, and Local when the channel is local', () => {
    const manifest = anAppManifest({ channel: 'local' });

    expect(versionLabel(manifest)).toBe(
      `${manifest.version} · ${manifest.buildId.slice(0, 7)} · Local`,
    );
  });
});

describe('versionBuildIdLabel', () => {
  it('should append the build id when the build is not canonical', () => {
    const manifest = anAppManifest();

    expect(versionBuildIdLabel(manifest)).toBe(
      `${manifest.version}-${manifest.buildId}`,
    );
  });

  it('should show only the version when the build is canonical', () => {
    const manifest = anAppManifest({ buildId: 'canonical' });

    expect(versionBuildIdLabel(manifest)).toBe(manifest.version);
  });
});

describe('isArtifactVersionSupportedByHost', () => {
  it('should support the host manifest when its id is the host id', () => {
    const host = aHostManifest();

    expect(
      isArtifactVersionSupportedByHost({
        artifactVersion: host,
        hostId: host.id,
      }),
    ).toBe(true);
  });

  it('should not support the host manifest when its id is another host id', () => {
    expect(
      isArtifactVersionSupportedByHost({
        artifactVersion: aHostManifest(),
        hostId: faker.string.uuid(),
      }),
    ).toBe(false);
  });

  it('should support the app when it lists every host', () => {
    expect(
      isArtifactVersionSupportedByHost({
        artifactVersion: anAppManifest({ supportedHosts: ['*'] }),
        hostId: faker.string.uuid(),
      }),
    ).toBe(true);
  });

  it('should support the app when it lists the host id', () => {
    const hostId = faker.string.uuid();

    expect(
      isArtifactVersionSupportedByHost({
        artifactVersion: anAppManifest({ supportedHosts: [hostId] }),
        hostId,
      }),
    ).toBe(true);
  });

  it('should support the app when a placement targets the host', () => {
    const hostId = faker.string.uuid();

    expect(
      isArtifactVersionSupportedByHost({
        artifactVersion: anAppManifest({
          supportedHosts: [],
          placements: [aRoutePlacement({ hostId })],
        }),
        hostId,
      }),
    ).toBe(true);
  });

  it('should not support the app when nothing targets the host', () => {
    expect(
      isArtifactVersionSupportedByHost({
        artifactVersion: anAppManifest({
          supportedHosts: [faker.string.uuid()],
          placements: [],
        }),
        hostId: faker.string.uuid(),
      }),
    ).toBe(false);
  });
});
