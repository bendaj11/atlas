import { faker } from '@faker-js/faker';
import {
  aHostArtifactVersion,
  anAppArtifactVersion,
  aVersionOf,
} from '../../../types/artifact-version.testkit';
import { anArtifact } from '../../../types/artifact.testkit';
import { ArtifactVersionUtilsDriver } from './artifact-version-utils.driver';

const DEPLOYED = anAppArtifactVersion({
  channel: 'production',
  version: '1.0.0',
  buildId: 'b1',
});
const NEWER = anAppArtifactVersion({
  channel: 'production',
  version: '2.0.0',
  buildId: 'b2',
});
const PREVIEW = anAppArtifactVersion({
  channel: 'pr',
  prNumber: 42,
  buildId: 'pr42',
});
const LOCAL = anAppArtifactVersion({
  channel: 'local',
  remoteEntryUrl: 'http://localhost:4201/app/remoteEntry.json',
});

describe('configurationOf', () => {
  let driver: ArtifactVersionUtilsDriver;

  beforeEach(() => {
    driver = new ArtifactVersionUtilsDriver();
  });

  describe('when the artifact is deployed', () => {
    const artifact = anArtifact({
      key: 'app:orders',
      productionArtifactVersion: DEPLOYED,
    });

    beforeEach(() => {
      driver.given.artifact(artifact);
    });

    it('should use the artifact key when building the configuration', () => {
      driver.when.configurationBuilt();

      expect(driver.get.configuration().key).toBe('app:orders');
    });

    it('should keep the artifact fields when building the configuration', () => {
      const sourceDescription = faker.lorem.words();

      driver.given
        .artifact(anArtifact({ ...artifact, sourceDescription }))
        .when.configurationBuilt();

      expect(driver.get.configuration().sourceDescription).toBe(
        sourceDescription,
      );
    });

    it('should use the session host id when building the configuration', () => {
      driver.when.configurationBuilt();

      expect(driver.get.configuration().hostId).toBe(driver.get.hostId());
    });

    it('should have no selected manifest when no override exists', () => {
      driver.when.configurationBuilt();

      expect(
        driver.get.configuration().selectedArtifactVersion,
      ).toBeUndefined();
    });

    it('should select the active override when one exists', () => {
      driver.given.activeOverride(PREVIEW).when.configurationBuilt();

      expect(driver.get.configuration().selectedArtifactVersion).toBe(PREVIEW);
    });

    it('should select the disabled override when no active override exists', () => {
      driver.given.disabledOverride(LOCAL).when.configurationBuilt();

      expect(driver.get.configuration().selectedArtifactVersion).toBe(LOCAL);
    });

    it('should prefer the active override when both overrides exist', () => {
      driver.given
        .activeOverride(PREVIEW)
        .given.disabledOverride(LOCAL)
        .when.configurationBuilt();

      expect(driver.get.configuration().selectedArtifactVersion).toBe(PREVIEW);
    });

    it('should list host production versions plus the deployed manifest when building production options', () => {
      const older = aVersionOf(DEPLOYED, { channel: 'production' });

      driver.given
        .hostVersion(older)
        .given.hostVersion(aVersionOf(DEPLOYED, { channel: 'pr' }))
        .when.configurationBuilt();

      expect(driver.get.configuration().productionArtifactVersions).toEqual([
        older,
        DEPLOYED,
      ]);
    });

    it('should not duplicate the deployed manifest when host versions already include it', () => {
      driver.given.hostVersion(DEPLOYED).when.configurationBuilt();

      expect(driver.get.configuration().productionArtifactVersions).toEqual([
        DEPLOYED,
      ]);
    });

    it('should list only pr versions when building pr options', () => {
      const preview = aVersionOf(DEPLOYED, { channel: 'pr', prNumber: 42 });

      driver.given
        .hostVersion(aVersionOf(DEPLOYED, { channel: 'production' }))
        .given.hostVersion(preview)
        .when.configurationBuilt();

      expect(driver.get.configuration().prArtifactVersions).toEqual([preview]);
    });
  });
});

describe('initialOverrideSelection', () => {
  let driver: ArtifactVersionUtilsDriver;

  beforeEach(() => {
    driver = new ArtifactVersionUtilsDriver();
  });

  it('should select an empty custom url when no override exists', () => {
    driver.given
      .selectedArtifactVersion(undefined)
      .when.initialSelectionBuilt();

    expect(driver.get.initialSelection()).toEqual({
      type: 'custom',
      value: '',
    });
  });

  it('should select the base url when a local override exists', () => {
    driver.given.selectedArtifactVersion(LOCAL).when.initialSelectionBuilt();

    expect(driver.get.initialSelection()).toEqual({
      type: 'custom',
      value: 'http://localhost:4201/app',
    });
  });

  it('should select the production version key when a production override exists', () => {
    driver.given.selectedArtifactVersion(NEWER).when.initialSelectionBuilt();

    expect(driver.get.initialSelection()).toEqual({
      type: 'production',
      value: 'production:2.0.0:b2',
    });
  });

  it('should select the pr version key when a pr override exists', () => {
    driver.given.selectedArtifactVersion(PREVIEW).when.initialSelectionBuilt();

    expect(driver.get.initialSelection()).toEqual({
      type: 'pr',
      value: 'pr:42:pr42',
    });
  });
});

describe('artifactVersionFromSelection', () => {
  let driver: ArtifactVersionUtilsDriver;

  beforeEach(() => {
    driver = new ArtifactVersionUtilsDriver();
  });

  it('should build a local manifest when the selection is custom', () => {
    driver.given
      .productionArtifactVersion(anAppArtifactVersion({ framework: 'react' }))
      .given.selection({ type: 'custom', value: 'http://localhost:4201/' })
      .when.manifestResolved();

    expect(driver.get.resolved()).toMatchObject({
      channel: 'local',
      remoteEntryUrl: 'http://localhost:4201/remoteEntry.json',
      styles: [],
    });
  });

  it('should add a local stylesheet when the custom app is angular', () => {
    driver.given
      .productionArtifactVersion(anAppArtifactVersion({ framework: 'angular' }))
      .given.selection({ type: 'custom', value: 'http://localhost:4201' })
      .when.manifestResolved();

    expect(driver.get.resolved()?.styles).toEqual([
      { href: 'http://localhost:4201/styles.css' },
    ]);
  });

  it('should drop the production integrity when the selection is custom', () => {
    driver.given
      .productionArtifactVersion(
        anAppArtifactVersion({ integrity: 'sha256-prod' }),
      )
      .given.selection({ type: 'custom', value: 'http://localhost:4201' })
      .when.manifestResolved();

    expect(driver.get.resolved()?.integrity).toBeUndefined();
  });

  it('should point exported widgets at the local entry when the selection is custom', () => {
    driver.given
      .productionArtifactVersion(
        anAppArtifactVersion({
          exportedWidgets: [
            {
              schemaVersion: '1',
              id: 'summary',
              name: 'Summary',
              ownerAppId: 'app',
              framework: 'react',
              remoteEntryUrl: 'https://cdn.example/summary.js',
              expose: './summary',
              contractVersion: '1',
            },
          ],
        }),
      )
      .given.selection({ type: 'custom', value: 'http://localhost:4201' })
      .when.manifestResolved();

    expect(driver.get.resolvedExportedWidgets()[0]?.remoteEntryUrl).toBe(
      'http://localhost:4201/remoteEntry.json',
    );
  });

  it.each([
    'http://127.0.0.1:4201/remoteEntry.json',
    'http://localhost:4201/remoteEntry.json',
  ])('should keep the remote entry url when the custom url is %s', (url) => {
    driver.given
      .selection({ type: 'custom', value: url })
      .when.manifestResolved();

    expect(driver.get.resolved()?.remoteEntryUrl).toBe(url);
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
  ])('should reject the custom url %s when it is unsafe', (url, message) => {
    driver.given
      .selection({ type: 'custom', value: url })
      .when.manifestResolved();

    expect(driver.get.errorMessage()).toBe(message);
  });

  it('should pick the production option when its key matches the selection', () => {
    driver.given
      .productionArtifactVersions([DEPLOYED, NEWER])
      .given.selection({ type: 'production', value: 'production:2.0.0:b2' })
      .when.manifestResolved();

    expect(driver.get.resolved()).toBe(NEWER);
  });

  it('should fail when the production key matches no option', () => {
    driver.given
      .productionArtifactVersions([DEPLOYED])
      .given.selection({ type: 'production', value: 'missing' })
      .when.manifestResolved();

    expect(driver.get.errorMessage()).toBe('Choose a production version.');
  });

  it('should pick the pr option when its key matches the selection', () => {
    driver.given
      .prArtifactVersions([PREVIEW])
      .given.selection({ type: 'pr', value: 'pr:42:pr42' })
      .when.manifestResolved();

    expect(driver.get.resolved()).toBe(PREVIEW);
  });

  it('should fail when the pr key matches no option', () => {
    driver.given
      .selection({ type: 'pr', value: 'missing' })
      .when.manifestResolved();

    expect(driver.get.errorMessage()).toBe('Choose a PR version.');
  });
});

describe('normalizeStoredArtifactVersion', () => {
  let driver: ArtifactVersionUtilsDriver;

  beforeEach(() => {
    driver = new ArtifactVersionUtilsDriver();
  });

  it('should restore the local version when a legacy local manifest stored the build id as version', () => {
    driver.when.storedManifestNormalized(
      anAppArtifactVersion({ channel: 'local', version: 'custom-url' }),
    );

    expect(driver.get.normalizedManifest()?.version).toBe('0.0.0-local');
  });

  it('should keep the manifest when it is not a legacy local manifest', () => {
    driver.when.storedManifestNormalized(DEPLOYED);

    expect(driver.get.normalizedManifest()).toBe(DEPLOYED);
  });
});

describe('overrideTypeFor', () => {
  let driver: ArtifactVersionUtilsDriver;

  beforeEach(() => {
    driver = new ArtifactVersionUtilsDriver();
  });

  it.each([
    [undefined, undefined],
    [LOCAL, 'custom'],
    [PREVIEW, 'pr'],
    [NEWER, 'production'],
    [DEPLOYED, undefined],
  ])(
    'should classify the selection as %p when the selected manifest is the given one',
    (selected, type) => {
      driver.given
        .productionArtifactVersion(DEPLOYED)
        .given.selectedArtifactVersion(selected)
        .when.overrideTypeComputed();

      expect(driver.get.overrideType()).toBe(type);
    },
  );
});

describe('versionLabel', () => {
  let driver: ArtifactVersionUtilsDriver;

  beforeEach(() => {
    driver = new ArtifactVersionUtilsDriver();
  });

  it('should join version, build id, and commit title when the release is production', () => {
    driver.when.versionLabelled(
      anAppArtifactVersion({
        channel: 'production',
        version: '1.2.3',
        buildId: 'abcdef123456',
        gitCommitTitle: 'Simplify',
      }),
    );

    expect(driver.get.label()).toBe('1.2.3-abcdef123456 · Simplify');
  });

  it('should show only the version when the build is canonical and the title is punctuation', () => {
    driver.when.versionLabelled(
      anAppArtifactVersion({
        channel: 'production',
        version: '0.1.2',
        buildId: 'canonical',
        gitCommitTitle: '.',
      }),
    );

    expect(driver.get.label()).toBe('0.1.2');
  });

  it('should show pr number, branch, short sha, and title when the release is a pr', () => {
    driver.when.versionLabelled(
      anAppArtifactVersion({
        channel: 'pr',
        prNumber: 42,
        gitBranch: 'feature/labels',
        gitSha: 'abcdef123456',
        gitCommitTitle: 'Simplify',
      }),
    );

    expect(driver.get.label()).toBe(
      'PR #42 · feature/labels · abcdef1 · Simplify',
    );
  });

  it('should fall back to the pr number when the pr has no metadata', () => {
    driver.when.versionLabelled(
      anAppArtifactVersion({ channel: 'pr', prNumber: 42 }),
    );

    expect(driver.get.label()).toBe('PR #42');
  });

  it('should show version, short build id, and Local when the release is local', () => {
    driver.when.versionLabelled(
      anAppArtifactVersion({
        channel: 'local',
        version: '0.0.0-local',
        buildId: 'custom-url',
      }),
    );

    expect(driver.get.label()).toBe('0.0.0-local · custom- · Local');
  });
});

describe('versionBuildIdLabel', () => {
  let driver: ArtifactVersionUtilsDriver;

  beforeEach(() => {
    driver = new ArtifactVersionUtilsDriver();
  });

  it('should append the build id when the build is not canonical', () => {
    driver.when.versionBuildIdLabelled(
      anAppArtifactVersion({ version: '1.0.0', buildId: 'b1' }),
    );

    expect(driver.get.label()).toBe('1.0.0-b1');
  });

  it('should show only the version when the build is canonical', () => {
    driver.when.versionBuildIdLabelled(
      anAppArtifactVersion({ version: '1.0.0', buildId: 'canonical' }),
    );

    expect(driver.get.label()).toBe('1.0.0');
  });
});

describe('artifactSourceDescription', () => {
  let driver: ArtifactVersionUtilsDriver;

  beforeEach(() => {
    driver = new ArtifactVersionUtilsDriver();
  });

  it('should be empty when there is no override', () => {
    driver.when.sourceDescribed(undefined);

    expect(driver.get.label()).toBe('');
  });

  it('should show the base url when the override is local', () => {
    driver.when.sourceDescribed(LOCAL);

    expect(driver.get.label()).toBe('http://localhost:4201/app');
  });

  it('should show the version label when the override is not local', () => {
    driver.when.sourceDescribed(
      anAppArtifactVersion({ channel: 'pr', prNumber: 7 }),
    );

    expect(driver.get.label()).toBe('PR #7');
  });
});

describe('isArtifactVersionSupportedByHost', () => {
  let driver: ArtifactVersionUtilsDriver;

  beforeEach(() => {
    driver = new ArtifactVersionUtilsDriver();
  });

  it('should support the host manifest when its id is the host id', () => {
    driver.when.hostSupportChecked(
      aHostArtifactVersion({ id: 'shop' }),
      'shop',
    );

    expect(driver.get.supported()).toBe(true);
  });

  it('should support an app when it lists every host', () => {
    driver.when.hostSupportChecked(
      anAppArtifactVersion({ supportedHosts: ['*'] }),
      'shop',
    );

    expect(driver.get.supported()).toBe(true);
  });

  it('should support an app when it lists the host id', () => {
    driver.when.hostSupportChecked(
      anAppArtifactVersion({ supportedHosts: ['shop'] }),
      'shop',
    );

    expect(driver.get.supported()).toBe(true);
  });

  it('should support an app when a placement targets the host', () => {
    driver.when.hostSupportChecked(
      anAppArtifactVersion({
        supportedHosts: [],
        placements: [{ id: 'orders', kind: 'route', hostId: 'shop' }],
      }),
      'shop',
    );

    expect(driver.get.supported()).toBe(true);
  });

  it('should not support an app when nothing targets the host', () => {
    driver.when.hostSupportChecked(
      anAppArtifactVersion({ supportedHosts: ['other'], placements: [] }),
      'shop',
    );

    expect(driver.get.supported()).toBe(false);
  });
});

describe('isDeployedProductionVersion', () => {
  let driver: ArtifactVersionUtilsDriver;

  beforeEach(() => {
    driver = new ArtifactVersionUtilsDriver();
  });

  it('should not mark a version as deployed when nothing is deployed', () => {
    driver.when.deployedVersionChecked(DEPLOYED, undefined);

    expect(driver.get.deployed()).toBe(false);
  });

  it('should mark a version as deployed when its key matches the deployed production manifest', () => {
    driver.when.deployedVersionChecked(DEPLOYED, DEPLOYED);

    expect(driver.get.deployed()).toBe(true);
  });

  it('should not mark a version as deployed when its key differs from the deployed manifest', () => {
    driver.when.deployedVersionChecked(NEWER, DEPLOYED);

    expect(driver.get.deployed()).toBe(false);
  });

  it('should not mark a version as deployed when it is a preview build', () => {
    driver.when.deployedVersionChecked(PREVIEW, PREVIEW);

    expect(driver.get.deployed()).toBe(false);
  });
});
