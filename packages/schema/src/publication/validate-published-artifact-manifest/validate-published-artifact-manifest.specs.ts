import { faker } from '@faker-js/faker';
import { aRoutePlacement, aSlotPlacement } from '@atlas/testkit';
import {
  aHostArtifactManifest,
  aPayloadFileDescriptor,
  aPublishedWidget,
  aRemoteEntryFile,
  aRouteContribution,
  aSha256Digest,
  aStylesheetFile,
  anAppArtifactManifest,
} from '@atlas/testkit/internal';
import { AtlasValidationError } from '../../errors/atlas-validation-error/atlas-validation-error.js';
import { ATLAS_DOM_ISOLATIONS } from '../../manifest/atlas-dom-isolation.js';
import { ATLAS_FRAMEWORKS } from '../../manifest/atlas-framework.js';
import { ValidatePublishedArtifactManifestDriver } from './validate-published-artifact-manifest.driver.js';

const ZERO_DIGEST = `sha256:${'00'.repeat(32)}` as const;
const ZERO_INTEGRITY = `sha256-${'A'.repeat(43)}=`;
const EXTRA_FILE_ROLES = ['script', 'asset', 'source-map'] as const;

describe('validatePublishedArtifactManifest', () => {
  let driver: ValidatePublishedArtifactManifestDriver;

  beforeEach(() => {
    driver = new ValidatePublishedArtifactManifestDriver();
  });

  it('should report nothing when an app artifact is complete', () => {
    driver.when.validated(anAppArtifactManifest());

    expect(driver.get.issues()).toEqual([]);
  });

  it('should report nothing when a host artifact is complete', () => {
    driver.when.validated(aHostArtifactManifest());

    expect(driver.get.issues()).toEqual([]);
  });

  it('should report a single object issue when the value is not an object', () => {
    driver.when.validated(faker.lorem.word());

    expect(driver.get.issues()).toEqual([
      { path: '', message: 'Expected the manifest to be an object.' },
    ]);
  });

  it('should report every required field once when the value is an empty object', () => {
    driver.when.validated({});

    expect(driver.get.issuePaths()).toEqual([
      'schemaVersion',
      'kind',
      'id',
      'name',
      'entryPath',
      'framework',
      'exposes',
      'release',
      'files',
    ]);
  });

  it('should report schemaVersion when it is not "2"', () => {
    driver.when.validated({ ...anAppArtifactManifest(), schemaVersion: '1' });

    expect(driver.get.issues()).toEqual([
      { path: 'schemaVersion', message: 'Expected schemaVersion to be "2".' },
    ]);
  });

  it('should report kind when it is unknown', () => {
    driver.when.validated({ ...aHostArtifactManifest(), kind: 'host' });

    expect(driver.get.issues()).toEqual([
      {
        path: 'kind',
        message: 'Expected kind to be app-artifact or host-artifact.',
      },
    ]);
  });

  it('should report id when it is not a URL-safe segment', () => {
    driver.when.validated(anAppArtifactManifest({ id: '../orders' }));

    expect(driver.get.issuePaths()).toEqual(['id']);
  });

  it('should report packageName when it is empty', () => {
    driver.when.validated(anAppArtifactManifest({ packageName: '' }));

    expect(driver.get.issues()).toEqual([
      {
        path: 'packageName',
        message: 'Expected packageName to be a non-empty string.',
      },
    ]);
  });

  it.each(ATLAS_FRAMEWORKS)(
    'should report nothing when framework is %s',
    (framework) => {
      driver.when.validated(anAppArtifactManifest({ framework }));

      expect(driver.get.issues()).toEqual([]);
    },
  );

  it('should report framework when it is unsupported', () => {
    driver.when.validated({ ...anAppArtifactManifest(), framework: 'svelte' });

    expect(driver.get.issues()).toEqual([
      {
        path: 'framework',
        message: 'Expected framework to be angular, react, or vue.',
      },
    ]);
  });

  it('should report the entry expose when it is missing', () => {
    driver.when.validated({ ...anAppArtifactManifest(), exposes: {} });

    expect(driver.get.issues()).toEqual([
      {
        path: 'exposes.entry',
        message: 'Expected entry to be a non-empty string.',
      },
    ]);
  });

  it('should report an extra expose when it is empty', () => {
    const name = faker.lorem.word();
    driver.when.validated(
      anAppArtifactManifest({ exposes: { entry: './entry', [name]: '' } }),
    );

    expect(driver.get.issues()).toEqual([
      {
        path: `exposes.${name}`,
        message: 'Expected expose path to be a non-empty string.',
      },
    ]);
  });

  it('should report nothing when only a preview identity is given', () => {
    const { release: _release, ...manifest } = anAppArtifactManifest();
    driver.when.validated({
      ...manifest,
      preview: {
        number: faker.number.int({ min: 1, max: 999 }),
        gitSha: faker.git.commitSha(),
      },
    });

    expect(driver.get.issues()).toEqual([]);
  });

  it('should report release when both release and preview are given', () => {
    driver.when.validated(
      anAppArtifactManifest({
        preview: { number: 1, gitSha: faker.git.commitSha() },
      }),
    );

    expect(driver.get.issues()).toEqual([
      {
        path: 'release',
        message: 'Expected exactly one of release or preview identity.',
      },
    ]);
  });

  it('should report release when neither release nor preview is given', () => {
    const { release: _release, ...manifest } = anAppArtifactManifest();
    driver.when.validated(manifest);

    expect(driver.get.issues()).toEqual([
      {
        path: 'release',
        message: 'Expected exactly one of release or preview identity.',
      },
    ]);
  });

  it('should report release.version when it is reserved', () => {
    driver.when.validated(
      anAppArtifactManifest({ release: { version: 'latest' } }),
    );

    expect(driver.get.issues()).toEqual([
      {
        path: 'release.version',
        message:
          'Expected release version to be a concrete version, "latest" is reserved.',
      },
    ]);
  });

  it('should report preview number, gitSha and git text fields when they are invalid', () => {
    const { release: _release, ...manifest } = anAppArtifactManifest();
    driver.when.validated({
      ...manifest,
      preview: { number: 0, gitSha: '', gitBranch: '', gitCommitTitle: 3 },
    });

    expect(driver.get.issuePaths()).toEqual([
      'preview.number',
      'preview.gitSha',
      'preview.gitBranch',
      'preview.gitCommitTitle',
    ]);
  });

  it('should report nothing when source carries git fields', () => {
    driver.when.validated(
      anAppArtifactManifest({
        source: {
          gitSha: faker.git.commitSha(),
          gitBranch: faker.git.branch(),
          gitCommitTitle: faker.git.commitMessage(),
        },
      }),
    );

    expect(driver.get.issues()).toEqual([]);
  });

  it('should report source when it is not an object', () => {
    driver.when.validated({ ...anAppArtifactManifest(), source: 'main' });

    expect(driver.get.issues()).toEqual([
      { path: 'source', message: 'Expected source to be an object.' },
    ]);
  });

  it('should report each empty git field when source fields are empty', () => {
    driver.when.validated(
      anAppArtifactManifest({
        source: { gitSha: '', gitBranch: '', gitCommitTitle: '' },
      }),
    );

    expect(driver.get.issuePaths()).toEqual([
      'source.gitSha',
      'source.gitBranch',
      'source.gitCommitTitle',
    ]);
  });

  it('should report files when it is not an array', () => {
    driver.when.validated({ ...anAppArtifactManifest(), files: {} });

    expect(driver.get.issuePaths()).toEqual(['files']);
  });

  it('should report the file when it is not an object', () => {
    const entry = aRemoteEntryFile();
    driver.when.validated({
      ...anAppArtifactManifest(),
      entryPath: entry.path,
      files: [entry, 'x'],
    });

    expect(driver.get.issues()).toEqual([
      {
        path: 'files.1',
        message: 'Expected file descriptor to be an object.',
      },
    ]);
  });

  it.each(EXTRA_FILE_ROLES)(
    'should report nothing when an extra file has role %s',
    (role) => {
      const entry = aRemoteEntryFile();
      driver.when.validated(
        anAppArtifactManifest({
          entryPath: entry.path,
          files: [entry, aPayloadFileDescriptor({ role })],
        }),
      );

      expect(driver.get.issues()).toEqual([]);
    },
  );

  it('should report path, digest, size, mediaType, cacheControl and role when a file is malformed', () => {
    const entry = aRemoteEntryFile();
    driver.when.validated({
      ...anAppArtifactManifest(),
      entryPath: entry.path,
      files: [
        entry,
        {
          path: '../escape.js',
          digest: 'sha256:short',
          size: -1,
          mediaType: 'css',
          cacheControl: 'no-cache',
          role: 'document',
        },
      ],
    });

    expect(driver.get.issuePaths()).toEqual([
      'files.1.path',
      'files.1.digest',
      'files.1.size',
      'files.1.mediaType',
      'files.1.cacheControl',
      'files.1.role',
    ]);
  });

  it('should report the file path when the manifest lists itself', () => {
    const entry = aRemoteEntryFile();
    driver.when.validated(
      anAppArtifactManifest({
        entryPath: entry.path,
        files: [entry, aPayloadFileDescriptor({ path: 'manifest.json' })],
      }),
    );

    expect(driver.get.issues()).toEqual([
      { path: 'files.1.path', message: 'The manifest must not list itself.' },
    ]);
  });

  it('should report the second file path when two files share one', () => {
    const entry = aRemoteEntryFile();
    driver.when.validated(
      anAppArtifactManifest({
        entryPath: entry.path,
        files: [entry, aPayloadFileDescriptor({ path: entry.path })],
      }),
    );

    expect(driver.get.issues()).toEqual([
      {
        path: 'files.1.path',
        message: `Duplicate file path "${entry.path}".`,
      },
    ]);
  });

  it('should report files when entryPath is not listed', () => {
    const entryPath = faker.system.commonFileName('js');
    driver.when.validated(anAppArtifactManifest({ entryPath }));

    expect(driver.get.issues()).toEqual([
      {
        path: 'files',
        message: `Expected entryPath "${entryPath}" to identify one listed payload file.`,
      },
    ]);
  });

  it('should report files when the entry file is not a remote entry', () => {
    const entry = aPayloadFileDescriptor({ role: 'script' });
    driver.when.validated(
      anAppArtifactManifest({ entryPath: entry.path, files: [entry] }),
    );

    expect(driver.get.issues()).toEqual([
      {
        path: 'files',
        message: `Expected the entryPath file "${entry.path}" to have role remote-entry.`,
      },
      {
        path: 'files',
        message: 'Expected exactly one file with role remote-entry.',
      },
    ]);
  });

  it('should report files when two files claim role remote-entry', () => {
    const entry = aRemoteEntryFile();
    driver.when.validated(
      anAppArtifactManifest({
        entryPath: entry.path,
        files: [entry, aRemoteEntryFile()],
      }),
    );

    expect(driver.get.issues()).toEqual([
      {
        path: 'files',
        message: 'Expected exactly one file with role remote-entry.',
      },
    ]);
  });

  it('should report nothing when every stylesheet file has a matching descriptor', () => {
    const entry = aRemoteEntryFile();
    const stylesheet = aStylesheetFile({ digest: ZERO_DIGEST });
    driver.when.validated(
      anAppArtifactManifest({
        entryPath: entry.path,
        files: [entry, stylesheet],
        styles: [{ path: stylesheet.path, integrity: ZERO_INTEGRITY }],
      }),
    );

    expect(driver.get.issues()).toEqual([]);
  });

  it('should report styles when a stylesheet file has no descriptor', () => {
    const entry = aRemoteEntryFile();
    driver.when.validated(
      anAppArtifactManifest({
        entryPath: entry.path,
        files: [entry, aStylesheetFile()],
      }),
    );

    expect(driver.get.issues()).toEqual([
      {
        path: 'styles',
        message: 'Expected a styles descriptor for every stylesheet file.',
      },
    ]);
  });

  it('should report styles when it is not an array', () => {
    driver.when.validated({ ...anAppArtifactManifest(), styles: {} });

    expect(driver.get.issues()).toEqual([
      { path: 'styles', message: 'Expected styles to be an array.' },
    ]);
  });

  it('should report the descriptor when it is not an object', () => {
    driver.when.validated({ ...anAppArtifactManifest(), styles: ['x'] });

    expect(driver.get.issues()).toEqual([
      {
        path: 'styles.0',
        message: 'Expected stylesheet descriptor to be an object.',
      },
    ]);
  });

  it('should report the descriptor path when it names no stylesheet file', () => {
    const path = faker.system.commonFileName('css');
    driver.when.validated(
      anAppArtifactManifest({
        styles: [{ path, integrity: ZERO_INTEGRITY }],
      }),
    );

    expect(driver.get.issues()).toEqual([
      {
        path: 'styles.0.path',
        message: `Expected "${path}" to identify a file with role stylesheet.`,
      },
    ]);
  });

  it('should report the descriptor integrity when it is not SRI', () => {
    const entry = aRemoteEntryFile();
    const stylesheet = aStylesheetFile();
    driver.when.validated(
      anAppArtifactManifest({
        entryPath: entry.path,
        files: [entry, stylesheet],
        styles: [{ path: stylesheet.path, integrity: 'sha256-invalid' }],
      }),
    );

    expect(driver.get.issues()).toEqual([
      {
        path: 'styles.0.integrity',
        message: 'Expected SHA-256 integrity in SRI format.',
      },
    ]);
  });

  it('should report the descriptor integrity when it differs from the file digest', () => {
    const entry = aRemoteEntryFile();
    const stylesheet = aStylesheetFile({ digest: aSha256Digest() });
    driver.when.validated(
      anAppArtifactManifest({
        entryPath: entry.path,
        files: [entry, stylesheet],
        styles: [{ path: stylesheet.path, integrity: ZERO_INTEGRITY }],
      }),
    );

    expect(driver.get.issues()).toEqual([
      {
        path: 'styles.0.integrity',
        message: `Expected integrity to match the digest of "${stylesheet.path}".`,
      },
    ]);
  });

  it('should report the second descriptor path and the missing coverage when descriptors repeat one file', () => {
    const entry = aRemoteEntryFile();
    const [first, second] = [
      aStylesheetFile({ digest: ZERO_DIGEST }),
      aStylesheetFile({ digest: ZERO_DIGEST }),
    ];
    driver.when.validated(
      anAppArtifactManifest({
        entryPath: entry.path,
        files: [entry, first, second],
        styles: [
          { path: first.path, integrity: ZERO_INTEGRITY },
          { path: first.path, integrity: ZERO_INTEGRITY },
        ],
      }),
    );

    expect(driver.get.issues()).toEqual([
      {
        path: 'styles.1.path',
        message: `Duplicate stylesheet path "${first.path}".`,
      },
      {
        path: 'styles',
        message: 'Expected a styles descriptor for every stylesheet file.',
      },
    ]);
  });

  it.each(ATLAS_DOM_ISOLATIONS)(
    'should report nothing when isolation is %s',
    (isolation) => {
      driver.when.validated(anAppArtifactManifest({ isolation }));

      expect(driver.get.issues()).toEqual([]);
    },
  );

  it('should report isolation when it is unknown', () => {
    driver.when.validated({ ...anAppArtifactManifest(), isolation: 'iframe' });

    expect(driver.get.issues()).toEqual([
      {
        path: 'isolation',
        message: 'Expected isolation to be shared-dom, shadow-dom, or scoped.',
      },
    ]);
  });

  it('should report requiredHostSdkVersion when it is not a range', () => {
    driver.when.validated(
      anAppArtifactManifest({ requiredHostSdkVersion: 'not-a-range' }),
    );

    expect(driver.get.issues()).toEqual([
      {
        path: 'requiredHostSdkVersion',
        message: 'Expected a semantic version range such as ^1.2.3.',
      },
    ]);
  });

  it('should report supportedHosts when it is empty', () => {
    driver.when.validated(anAppArtifactManifest({ supportedHosts: [] }));

    expect(driver.get.issues()).toEqual([
      {
        path: 'supportedHosts',
        message: 'Expected at least one supported host id.',
      },
    ]);
  });

  it('should report supportedHosts when it is not an array', () => {
    driver.when.validated({ ...anAppArtifactManifest(), supportedHosts: '*' });

    expect(driver.get.issues()).toEqual([
      {
        path: 'supportedHosts',
        message: 'Expected an array of supported host ids.',
      },
    ]);
  });

  it('should report supportedHosts when the wildcard is mixed with hosts', () => {
    driver.when.validated(
      anAppArtifactManifest({ supportedHosts: ['*', faker.string.uuid()] }),
    );

    expect(driver.get.issues()).toEqual([
      {
        path: 'supportedHosts',
        message: 'Expected "*" to be the only supported host when present.',
      },
    ]);
  });

  it('should report unsafe, non-string and duplicate hosts when present', () => {
    const hostId = faker.string.uuid();
    driver.when.validated({
      ...anAppArtifactManifest(),
      supportedHosts: ['../h', 1, hostId, hostId],
    });

    expect(driver.get.issuePaths()).toEqual([
      'supportedHosts.0',
      'supportedHosts.1',
      'supportedHosts.3',
    ]);
  });

  it('should report nothing when placements target the wildcard host and supportedHosts is the wildcard', () => {
    driver.when.validated(
      anAppArtifactManifest({
        placements: [
          aRoutePlacement({ hostId: '*' }),
          aSlotPlacement({ hostId: '*' }),
        ],
      }),
    );

    expect(driver.get.issues()).toEqual([]);
  });

  it('should report the placement host when it is not supported', () => {
    const hostId = faker.string.uuid();
    driver.when.validated(
      anAppArtifactManifest({
        supportedHosts: [faker.string.uuid()],
        placements: [aSlotPlacement({ hostId })],
      }),
    );

    expect(driver.get.issues()).toEqual([
      {
        path: 'placements.0.hostId',
        message: `Expected placement host "${hostId}" to be listed in supportedHosts.`,
      },
    ]);
  });

  it('should report only the unsafe hostId when a placement host is not a URL-safe segment', () => {
    driver.when.validated(
      anAppArtifactManifest({
        supportedHosts: ['*'],
        placements: [aSlotPlacement({ hostId: '../h' })],
      }),
    );

    expect(driver.get.issues()).toEqual([
      {
        path: 'placements.0.hostId',
        message:
          'Expected placement host id "../h" to be a URL-safe path segment.',
      },
    ]);
  });

  it('should report placements when it is not an array', () => {
    driver.when.validated({ ...anAppArtifactManifest(), placements: {} });

    expect(driver.get.issues()).toEqual([
      { path: 'placements', message: 'Expected placements to be an array.' },
    ]);
  });

  it('should report the placement when it is not an object', () => {
    driver.when.validated({
      ...anAppArtifactManifest(),
      supportedHosts: ['*'],
      placements: ['x'],
    });

    expect(driver.get.issues()).toEqual([
      {
        path: 'placements.0',
        message: 'Expected placement to be an object.',
      },
    ]);
  });

  it('should report the second placement id when two share id and host', () => {
    const placement = aSlotPlacement();
    driver.when.validated(
      anAppArtifactManifest({ placements: [placement, placement] }),
    );

    expect(driver.get.issues()).toEqual([
      {
        path: 'placements.1.id',
        message: `Duplicate placement "${placement.hostId}:${placement.id}".`,
      },
    ]);
  });

  it('should report kind when it is unknown', () => {
    driver.when.validated({
      ...anAppArtifactManifest({ supportedHosts: ['*'] }),
      placements: [{ ...aSlotPlacement(), kind: 'overlay' }],
    });

    expect(driver.get.issues()).toEqual([
      {
        path: 'placements.0.kind',
        message: 'Expected kind to be route or slot.',
      },
    ]);
  });

  it('should report slot and route when a slot placement lacks a slot and defines a route', () => {
    const { slot: _slot, ...placement } = aSlotPlacement();
    driver.when.validated(
      anAppArtifactManifest({
        placements: [{ ...placement, route: aRouteContribution() }],
      }),
    );

    expect(driver.get.issuePaths()).toEqual([
      'placements.0.slot',
      'placements.0.route',
    ]);
  });

  it('should report slot and route when a route placement defines a slot and lacks route details', () => {
    const { route: _route, ...placement } = aRoutePlacement();
    driver.when.validated(
      anAppArtifactManifest({
        placements: [{ ...placement, slot: faker.lorem.word() }],
      }),
    );

    expect(driver.get.issuePaths()).toEqual([
      'placements.0.slot',
      'placements.0.route',
    ]);
  });

  it('should report the route path when it is not a route pattern', () => {
    driver.when.validated(
      anAppArtifactManifest({
        placements: [
          aRoutePlacement({ route: aRouteContribution({ path: 'orders' }) }),
        ],
      }),
    );

    expect(driver.get.issuePaths()).toEqual(['placements.0.route.path']);
  });

  it('should report the second route path when two routes repeat a path on one host', () => {
    const hostId = faker.string.uuid();
    const route = aRouteContribution({ path: '/orders' });
    driver.when.validated(
      anAppArtifactManifest({
        placements: [
          aRoutePlacement({ hostId, route }),
          aRoutePlacement({ hostId, route }),
        ],
      }),
    );

    expect(driver.get.issues()).toEqual([
      {
        path: 'placements.1.route.path',
        message: `Duplicate route "${hostId}:/orders".`,
      },
    ]);
  });

  it('should report match, redirectTo, layoutId, title and nav when route fields are invalid', () => {
    driver.when.validated({
      ...anAppArtifactManifest({ supportedHosts: ['*'] }),
      placements: [
        {
          ...aRoutePlacement(),
          route: {
            path: '/legacy',
            match: 'exact',
            redirectTo: 'orders',
            layoutId: 'store',
            title: '',
            nav: 'menu',
          },
        },
      ],
    });

    expect(driver.get.issuePaths()).toEqual([
      'placements.0.route.match',
      'placements.0.route.redirectTo',
      'placements.0.route.layoutId',
      'placements.0.route.title',
      'placements.0.route.nav',
    ]);
  });

  it('should report nav label, order and visible when they have wrong types', () => {
    driver.when.validated({
      ...anAppArtifactManifest({ supportedHosts: ['*'] }),
      placements: [
        {
          ...aRoutePlacement(),
          route: {
            ...aRouteContribution(),
            nav: { label: '', order: 'first', visible: 'yes' },
          },
        },
      ],
    });

    expect(driver.get.issuePaths()).toEqual([
      'placements.0.route.nav.label',
      'placements.0.route.nav.order',
      'placements.0.route.nav.visible',
    ]);
  });

  it('should report nothing when a widget belongs to the app and shares its framework', () => {
    const manifest = anAppArtifactManifest();
    driver.when.validated({
      ...manifest,
      exportedWidgets: [
        aPublishedWidget({
          ownerAppId: manifest.id,
          framework: manifest.framework,
        }),
      ],
    });

    expect(driver.get.issues()).toEqual([]);
  });

  it('should report exportedWidgets when it is not an array', () => {
    driver.when.validated({ ...anAppArtifactManifest(), exportedWidgets: {} });

    expect(driver.get.issues()).toEqual([
      {
        path: 'exportedWidgets',
        message: 'Expected exportedWidgets to be an array.',
      },
    ]);
  });

  it('should report the widget when it is not an object', () => {
    driver.when.validated({
      ...anAppArtifactManifest(),
      exportedWidgets: ['x'],
    });

    expect(driver.get.issues()).toEqual([
      {
        path: 'exportedWidgets.0',
        message: 'Expected exported widget to be an object.',
      },
    ]);
  });

  it('should report ownerAppId and framework when they differ from the app', () => {
    const manifest = anAppArtifactManifest({ framework: 'react' });
    driver.when.validated({
      ...manifest,
      exportedWidgets: [aPublishedWidget({ framework: 'angular' })],
    });

    expect(driver.get.issues()).toEqual([
      {
        path: 'exportedWidgets.0.ownerAppId',
        message: 'Expected ownerAppId to match the app id.',
      },
      {
        path: 'exportedWidgets.0.framework',
        message: 'Expected framework to match the app framework.',
      },
    ]);
  });

  it('should report schemaVersion, contractVersion, id, name, expose and metadata when a widget is malformed', () => {
    const manifest = anAppArtifactManifest();
    driver.when.validated({
      ...manifest,
      exportedWidgets: [
        {
          ...aPublishedWidget({
            ownerAppId: manifest.id,
            framework: manifest.framework,
          }),
          schemaVersion: '2',
          contractVersion: '2',
          id: '../w',
          name: '',
          expose: '',
          metadata: { nested: { value: true } },
        },
      ],
    });

    expect(driver.get.issuePaths()).toEqual([
      'exportedWidgets.0.schemaVersion',
      'exportedWidgets.0.contractVersion',
      'exportedWidgets.0.id',
      'exportedWidgets.0.name',
      'exportedWidgets.0.expose',
      'exportedWidgets.0.metadata.nested',
    ]);
  });

  it('should report the second widget id when two widgets share one', () => {
    const manifest = anAppArtifactManifest();
    const widget = aPublishedWidget({
      ownerAppId: manifest.id,
      framework: manifest.framework,
    });
    driver.when.validated({ ...manifest, exportedWidgets: [widget, widget] });

    expect(driver.get.issues()).toEqual([
      {
        path: 'exportedWidgets.1.id',
        message: `Duplicate exported widget id "${widget.id}".`,
      },
    ]);
  });

  it('should report nothing when externalAppsDependencies are unique safe ids', () => {
    driver.when.validated(
      anAppArtifactManifest({
        externalAppsDependencies: [faker.string.uuid(), faker.string.uuid()],
      }),
    );

    expect(driver.get.issues()).toEqual([]);
  });

  it('should report an external dependency when it is unsafe', () => {
    driver.when.validated(
      anAppArtifactManifest({ externalAppsDependencies: ['../billing'] }),
    );

    expect(driver.get.issues()).toEqual([
      {
        path: 'externalAppsDependencies.0',
        message:
          'Expected external app id "../billing" to be a URL-safe path segment.',
      },
    ]);
  });

  it('should report a metadata entry when it is nested', () => {
    driver.when.validated({
      ...anAppArtifactManifest(),
      metadata: { nested: { value: true } },
    });

    expect(driver.get.issues()).toEqual([
      {
        path: 'metadata.nested',
        message: 'Expected a string, number, or boolean metadata value.',
      },
    ]);
  });

  it('should report requiredLoaderApiVersion when it is missing', () => {
    const { requiredLoaderApiVersion: _range, ...manifest } =
      aHostArtifactManifest();
    driver.when.validated(manifest);

    expect(driver.get.issues()).toEqual([
      {
        path: 'requiredLoaderApiVersion',
        message: 'Expected requiredLoaderApiVersion to be a non-empty string.',
      },
    ]);
  });

  it('should report requiredLoaderApiVersion when it is not a range', () => {
    driver.when.validated(
      aHostArtifactManifest({ requiredLoaderApiVersion: 'soon' }),
    );

    expect(driver.get.issues()).toEqual([
      {
        path: 'requiredLoaderApiVersion',
        message: 'Expected a semantic version range such as ^1.2.3.',
      },
    ]);
  });
});

describe('assertPublishedArtifactManifest', () => {
  let driver: ValidatePublishedArtifactManifestDriver;

  beforeEach(() => {
    driver = new ValidatePublishedArtifactManifestDriver();
  });

  it('should not throw when the manifest is valid', () => {
    expect(() => driver.when.asserted(anAppArtifactManifest())).not.toThrow();
  });

  it('should throw AtlasValidationError with every issue when the manifest is invalid', () => {
    expect(() => driver.when.asserted({})).toThrow(
      expect.objectContaining<Partial<AtlasValidationError>>({
        name: 'AtlasValidationError',
        issues: expect.arrayContaining([
          {
            path: 'schemaVersion',
            message: 'Expected schemaVersion to be "2".',
          },
          { path: 'files', message: 'Expected files to be an array.' },
        ]),
      }),
    );
  });
});
