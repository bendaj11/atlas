import { aHostManifest, aManifest } from '../../../types/app.testkit';
import { ManifestUtilsDriver } from './manifest-utils.driver';

const DEPLOYED = aManifest({ version: '1.0.0', buildId: 'b1' });
const NEWER = aManifest({ version: '2.0.0', buildId: 'b2' });
const PREVIEW = aManifest({ channel: 'pr', prNumber: 42, buildId: 'pr42' });
const LOCAL = aManifest({
  channel: 'local',
  remoteEntryUrl: 'http://localhost:4201/app/remoteEntry.json',
});

describe('createEditorDraft', () => {
  let driver: ManifestUtilsDriver;

  beforeEach(() => {
    driver = new ManifestUtilsDriver();
  });

  it('should default to a custom draft when there is no configuration', () => {
    driver.when.draftCreated(false);

    expect(driver.get.draft()).toEqual({
      type: 'custom',
      customUrl: '',
      productionKey: '',
      prKey: '',
    });
  });

  it('should start with an empty custom url when no override exists', () => {
    driver.given.productionManifest(DEPLOYED).when.draftCreated();

    expect(driver.get.draft().customUrl).toBe('');
  });

  it('should preselect the deployed production key when no override exists', () => {
    driver.given.productionManifest(DEPLOYED).when.draftCreated();

    expect(driver.get.draft().productionKey).toBe('production:1.0.0:b1');
  });

  it('should preselect the first pr option when no override exists', () => {
    driver.given.prOptions([PREVIEW]).when.draftCreated();

    expect(driver.get.draft().prKey).toBe('pr:42:pr42');
  });

  it('should restore the base url when a local override exists', () => {
    driver.given.selectedManifest(LOCAL).when.draftCreated();

    expect(driver.get.draft().customUrl).toBe('http://localhost:4201/app');
  });

  it('should select the production type when a production override exists', () => {
    driver.given
      .productionManifest(DEPLOYED)
      .given.selectedManifest(NEWER)
      .when.draftCreated();

    expect(driver.get.draft().type).toBe('production');
  });

  it('should preselect the overriding production key when a production override exists', () => {
    driver.given
      .productionManifest(DEPLOYED)
      .given.selectedManifest(NEWER)
      .when.draftCreated();

    expect(driver.get.draft().productionKey).toBe('production:2.0.0:b2');
  });

  it('should select the pr type when a pr override exists', () => {
    driver.given.selectedManifest(PREVIEW).when.draftCreated();

    expect(driver.get.draft().type).toBe('pr');
  });
});

describe('resolveSelectedManifest', () => {
  let driver: ManifestUtilsDriver;

  beforeEach(() => {
    driver = new ManifestUtilsDriver();
  });

  it('should build a local manifest when the draft is custom', () => {
    driver.given
      .productionManifest(aManifest({ framework: 'react' }))
      .given.draft({ type: 'custom', customUrl: 'http://localhost:4201/' })
      .when.manifestResolved();

    expect(driver.get.resolvedManifest()).toMatchObject({
      channel: 'local',
      remoteEntryUrl: 'http://localhost:4201/remoteEntry.json',
      styles: [],
    });
  });

  it('should add a local stylesheet when the custom app is angular', () => {
    driver.given
      .productionManifest(aManifest({ framework: 'angular' }))
      .given.draft({ type: 'custom', customUrl: 'http://localhost:4201' })
      .when.manifestResolved();

    expect(driver.get.resolvedManifest()?.styles).toEqual([
      { href: 'http://localhost:4201/styles.css' },
    ]);
  });

  it('should drop the production integrity when the draft is custom', () => {
    driver.given
      .productionManifest(aManifest({ integrity: 'sha256-prod' }))
      .given.draft({ type: 'custom', customUrl: 'http://localhost:4201' })
      .when.manifestResolved();

    expect(driver.get.resolvedManifest()?.integrity).toBeUndefined();
  });

  it('should point exported widgets at the local entry when the draft is custom', () => {
    driver.given
      .productionManifest(
        aManifest({
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
      .given.draft({ type: 'custom', customUrl: 'http://localhost:4201' })
      .when.manifestResolved();

    expect(
      driver.get.resolvedManifest()?.exportedWidgets?.[0]?.remoteEntryUrl,
    ).toBe('http://localhost:4201/remoteEntry.json');
  });

  it.each([
    'http://127.0.0.1:4201/remoteEntry.json',
    'http://localhost:4201/remoteEntry.json',
  ])('should keep the remote entry url when the custom url is %s', (url) => {
    driver.given
      .draft({ type: 'custom', customUrl: url })
      .when.manifestResolved();

    expect(driver.get.resolvedManifest()?.remoteEntryUrl).toBe(url);
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
      .draft({ type: 'custom', customUrl: url })
      .when.manifestResolved();

    expect(driver.get.errorMessage()).toBe(message);
  });

  it('should pick the production option when its key matches the draft', () => {
    driver.given
      .productionOptions([DEPLOYED, NEWER])
      .given.draft({ type: 'production', productionKey: 'production:2.0.0:b2' })
      .when.manifestResolved();

    expect(driver.get.resolvedManifest()).toBe(NEWER);
  });

  it('should fail when the production key matches no option', () => {
    driver.given
      .productionOptions([DEPLOYED])
      .given.draft({ type: 'production', productionKey: 'missing' })
      .when.manifestResolved();

    expect(driver.get.errorMessage()).toBe('Choose a production version.');
  });

  it('should pick the pr option when its key matches the draft', () => {
    driver.given
      .prOptions([PREVIEW])
      .given.draft({ type: 'pr', prKey: 'pr:42:pr42' })
      .when.manifestResolved();

    expect(driver.get.resolvedManifest()).toBe(PREVIEW);
  });

  it('should fail when the pr key matches no option', () => {
    driver.given
      .draft({ type: 'pr', prKey: 'missing' })
      .when.manifestResolved();

    expect(driver.get.errorMessage()).toBe('Choose a PR version.');
  });
});

describe('normalizeStoredManifest', () => {
  let driver: ManifestUtilsDriver;

  beforeEach(() => {
    driver = new ManifestUtilsDriver();
  });

  it('should restore the local version when a legacy local manifest stored the build id as version', () => {
    driver.when.storedManifestNormalized(
      aManifest({ channel: 'local', version: 'custom-url' }),
    );

    expect(driver.get.normalizedManifest()?.version).toBe('0.0.0-local');
  });

  it('should keep the manifest when it is not a legacy local manifest', () => {
    driver.when.storedManifestNormalized(DEPLOYED);

    expect(driver.get.normalizedManifest()).toBe(DEPLOYED);
  });
});

describe('overrideTypeFor', () => {
  let driver: ManifestUtilsDriver;

  beforeEach(() => {
    driver = new ManifestUtilsDriver();
  });

  it.each([
    [undefined, 'none'],
    [LOCAL, 'custom'],
    [PREVIEW, 'pr'],
    [NEWER, 'production'],
    [DEPLOYED, 'none'],
  ])(
    'should classify the selection as %p when the selected manifest is the given one',
    (selected, type) => {
      driver.given
        .productionManifest(DEPLOYED)
        .given.selectedManifest(selected)
        .when.overrideTypeComputed();

      expect(driver.get.overrideType()).toBe(type);
    },
  );
});

describe('versionLabel', () => {
  let driver: ManifestUtilsDriver;

  beforeEach(() => {
    driver = new ManifestUtilsDriver();
  });

  it('should join version, build id, and commit title when the release is production', () => {
    driver.when.versionLabelled(
      aManifest({
        version: '1.2.3',
        buildId: 'abcdef123456',
        gitCommitTitle: 'Simplify',
      }),
    );

    expect(driver.get.label()).toBe('1.2.3-abcdef123456 · Simplify');
  });

  it('should show only the version when the build is canonical and the title is punctuation', () => {
    driver.when.versionLabelled(
      aManifest({
        version: '0.1.2',
        buildId: 'canonical',
        gitCommitTitle: '.',
      }),
    );

    expect(driver.get.label()).toBe('0.1.2');
  });

  it('should show pr number, branch, short sha, and title when the release is a pr', () => {
    driver.when.versionLabelled(
      aManifest({
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
    driver.when.versionLabelled(aManifest({ channel: 'pr', prNumber: 42 }));

    expect(driver.get.label()).toBe('PR #42');
  });

  it('should show version, short build id, and Local when the release is local', () => {
    driver.when.versionLabelled(
      aManifest({
        channel: 'local',
        version: '0.0.0-local',
        buildId: 'custom-url',
      }),
    );

    expect(driver.get.label()).toBe('0.0.0-local · custom- · Local');
  });
});

describe('versionBuildIdLabel', () => {
  let driver: ManifestUtilsDriver;

  beforeEach(() => {
    driver = new ManifestUtilsDriver();
  });

  it('should append the build id when the build is not canonical', () => {
    driver.when.versionBuildIdLabelled(
      aManifest({ version: '1.0.0', buildId: 'b1' }),
    );

    expect(driver.get.label()).toBe('1.0.0-b1');
  });

  it('should show only the version when the build is canonical', () => {
    driver.when.versionBuildIdLabelled(
      aManifest({ version: '1.0.0', buildId: 'canonical' }),
    );

    expect(driver.get.label()).toBe('1.0.0');
  });
});

describe('artifactSourceDescription', () => {
  let driver: ManifestUtilsDriver;

  beforeEach(() => {
    driver = new ManifestUtilsDriver();
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
    driver.when.sourceDescribed(aManifest({ channel: 'pr', prNumber: 7 }));

    expect(driver.get.label()).toBe('PR #7');
  });
});

describe('isManifestSupportedByHost', () => {
  let driver: ManifestUtilsDriver;

  beforeEach(() => {
    driver = new ManifestUtilsDriver();
  });

  it('should support the host manifest when its id is the host id', () => {
    driver.when.hostSupportChecked(
      aHostManifest({ id: 'shop', supportedHosts: [] }),
      'shop',
    );

    expect(driver.get.supported()).toBe(true);
  });

  it('should support an app when it lists every host', () => {
    driver.when.hostSupportChecked(
      aManifest({ supportedHosts: ['*'] }),
      'shop',
    );

    expect(driver.get.supported()).toBe(true);
  });

  it('should support an app when it lists the host id', () => {
    driver.when.hostSupportChecked(
      aManifest({ supportedHosts: ['shop'] }),
      'shop',
    );

    expect(driver.get.supported()).toBe(true);
  });

  it('should support an app when a placement targets the host', () => {
    driver.when.hostSupportChecked(
      aManifest({ supportedHosts: [], placements: [{ hostId: 'shop' }] }),
      'shop',
    );

    expect(driver.get.supported()).toBe(true);
  });

  it('should not support an app when nothing targets the host', () => {
    driver.when.hostSupportChecked(
      aManifest({ supportedHosts: ['other'], placements: [] }),
      'shop',
    );

    expect(driver.get.supported()).toBe(false);
  });
});
