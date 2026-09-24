import { faker } from '@faker-js/faker';
import {
  aRoutePlacement,
  aSlotPlacement,
  aStylesheet,
  anAppManifest,
  anExportedWidgetManifest,
} from '@atlas/testkit';
import { aRouteContribution, aSha256Integrity } from '@atlas/testkit/internal';
import { ATLAS_DOM_ISOLATIONS } from '../atlas-dom-isolation.js';
import { ATLAS_FRAMEWORKS } from '../atlas-framework.js';
import { ATLAS_VERSION_CHANNELS } from '../atlas-version-channel.js';
import { ValidateAtlasManifestDriver } from './validate-atlas-manifest.driver.js';

const REQUIRED_STRING_FIELDS = [
  'name',
  'buildId',
  'createdAt',
  'version',
  'requiredHostSdkVersion',
  'remoteEntryUrl',
] as const;

describe('validateAtlasManifest', () => {
  let driver: ValidateAtlasManifestDriver;

  beforeEach(() => {
    driver = new ValidateAtlasManifestDriver();
  });

  it('should report nothing when the manifest is complete', () => {
    driver.when.validated(anAppManifest());

    expect(driver.get.issues()).toEqual([]);
  });

  it('should report every required field once when the value is not an object', () => {
    driver.when.validated(faker.lorem.word());

    expect(driver.get.issuePaths()).toEqual([
      'schemaVersion',
      'kind',
      'id',
      'name',
      'buildId',
      'createdAt',
      'channel',
      'framework',
      'version',
      'requiredHostSdkVersion',
      'remoteEntryUrl',
      'supportedHosts',
      'placements',
      'exposes',
    ]);
  });

  it('should report schemaVersion when it is not "1"', () => {
    driver.when.validated({ ...anAppManifest(), schemaVersion: '2' });

    expect(driver.get.issues()).toEqual([
      { path: 'schemaVersion', message: 'Expected schemaVersion to be "1".' },
    ]);
  });

  it('should report kind when it is not app', () => {
    driver.when.validated({ ...anAppManifest(), kind: 'host' });

    expect(driver.get.issues()).toEqual([
      { path: 'kind', message: 'Expected kind to be "app".' },
    ]);
  });

  it.each(REQUIRED_STRING_FIELDS)(
    'should report %s when it is empty',
    (field) => {
      driver.when.validated(anAppManifest({ [field]: '' }));

      expect(driver.get.issues()).toEqual([
        {
          path: field,
          message: `Expected ${field} to be a non-empty string.`,
        },
      ]);
    },
  );

  it('should report id when it contains traversal', () => {
    driver.when.validated(anAppManifest({ id: '../workspace' }));

    expect(driver.get.issues()).toEqual([
      {
        path: 'id',
        message:
          'Expected app id to contain only letters, numbers, dots, dashes, and underscores, without traversal.',
      },
    ]);
  });

  it.each(ATLAS_VERSION_CHANNELS)(
    'should report nothing when channel is %s',
    (channel) => {
      driver.when.validated(anAppManifest({ channel }));

      expect(driver.get.issues()).toEqual([]);
    },
  );

  it('should report channel when it is unknown', () => {
    driver.when.validated({ ...anAppManifest(), channel: faker.lorem.word() });

    expect(driver.get.issues()).toEqual([
      {
        path: 'channel',
        message: 'Expected channel to be production, pr, or local.',
      },
    ]);
  });

  it.each(ATLAS_FRAMEWORKS)(
    'should report nothing when framework is %s',
    (framework) => {
      driver.when.validated(anAppManifest({ framework }));

      expect(driver.get.issues()).toEqual([]);
    },
  );

  it('should report framework when it is unknown', () => {
    driver.when.validated({ ...anAppManifest(), framework: 'svelte' });

    expect(driver.get.issues()).toEqual([
      {
        path: 'framework',
        message: 'Expected framework to be angular, react, or vue.',
      },
    ]);
  });

  it.each(ATLAS_DOM_ISOLATIONS)(
    'should report nothing when isolation is %s',
    (isolation) => {
      driver.when.validated(anAppManifest({ isolation }));

      expect(driver.get.issues()).toEqual([]);
    },
  );

  it('should report nothing when isolation is omitted', () => {
    const { isolation: _isolation, ...manifest } = anAppManifest();
    driver.when.validated(manifest);

    expect(driver.get.issues()).toEqual([]);
  });

  it('should report isolation listing all members when it is unknown', () => {
    driver.when.validated({ ...anAppManifest(), isolation: 'iframe' });

    expect(driver.get.issues()).toEqual([
      {
        path: 'isolation',
        message: 'Expected isolation to be shared-dom, shadow-dom, or scoped.',
      },
    ]);
  });

  it('should report version when it is not semantic', () => {
    driver.when.validated(anAppManifest({ version: 'latest' }));

    expect(driver.get.issues()).toEqual([
      {
        path: 'version',
        message: 'Expected a semantic version such as 1.2.3.',
      },
    ]);
  });

  it('should report requiredHostSdkVersion when it is not a range', () => {
    driver.when.validated(
      anAppManifest({ requiredHostSdkVersion: 'next release' }),
    );

    expect(driver.get.issues()).toEqual([
      {
        path: 'requiredHostSdkVersion',
        message: 'Expected a semantic version range such as ^1.2.3.',
      },
    ]);
  });

  it('should report remoteEntryUrl when it is not HTTP(S)', () => {
    driver.when.validated(
      anAppManifest({ remoteEntryUrl: 'file:///tmp/entry.js' }),
    );

    expect(driver.get.issues()).toEqual([
      {
        path: 'remoteEntryUrl',
        message: 'Expected an absolute HTTP(S) URL.',
      },
    ]);
  });

  it('should report nothing when integrity is SRI', () => {
    driver.when.validated(anAppManifest({ integrity: aSha256Integrity() }));

    expect(driver.get.issues()).toEqual([]);
  });

  it('should report integrity when it is not SRI', () => {
    driver.when.validated(anAppManifest({ integrity: 'md5-invalid' }));

    expect(driver.get.issues()).toEqual([
      {
        path: 'integrity',
        message: 'Expected SHA-256 integrity in SRI format.',
      },
    ]);
  });

  it('should report prNumber when it is not a positive integer', () => {
    driver.when.validated(anAppManifest({ prNumber: 0 }));

    expect(driver.get.issues()).toEqual([
      {
        path: 'prNumber',
        message: 'Expected pull request number to be an integer of at least 1.',
      },
    ]);
  });

  it('should report a metadata entry when it is not a primitive', () => {
    driver.when.validated({ ...anAppManifest(), metadata: { bad: null } });

    expect(driver.get.issues()).toEqual([
      {
        path: 'metadata.bad',
        message: 'Expected a string, number, or boolean metadata value.',
      },
    ]);
  });

  it('should report a stylesheet href when it is duplicated', () => {
    const stylesheet = aStylesheet();
    driver.when.validated(anAppManifest({ styles: [stylesheet, stylesheet] }));

    expect(driver.get.issues()).toEqual([
      {
        path: 'styles.1.href',
        message: `Duplicate stylesheet href "${stylesheet.href}".`,
      },
    ]);
  });

  it('should report exposes when it is not an object', () => {
    driver.when.validated({ ...anAppManifest(), exposes: [] });

    expect(driver.get.issues()).toEqual([
      { path: 'exposes', message: 'Expected exposes to be an object.' },
    ]);
  });

  it('should report the entry once when it is empty', () => {
    driver.when.validated(anAppManifest({ exposes: { entry: '' } }));

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
      anAppManifest({ exposes: { entry: './entry', [name]: '' } }),
    );

    expect(driver.get.issues()).toEqual([
      {
        path: `exposes.${name}`,
        message: 'Expected expose path to be a non-empty string.',
      },
    ]);
  });

  it('should report nothing when the wildcard is the only host', () => {
    driver.when.validated(anAppManifest({ supportedHosts: ['*'] }));

    expect(driver.get.issues()).toEqual([]);
  });

  it('should report supportedHosts when it is empty', () => {
    driver.when.validated(anAppManifest({ supportedHosts: [] }));

    expect(driver.get.issues()).toEqual([
      {
        path: 'supportedHosts',
        message: 'Expected at least one supported host id.',
      },
    ]);
  });

  it('should report each bad entry when hosts are empty, duplicated or not strings', () => {
    const hostId = faker.string.uuid();
    driver.when.validated({
      ...anAppManifest(),
      supportedHosts: [hostId, '', hostId, 4],
    });

    expect(driver.get.issues()).toEqual([
      {
        path: 'supportedHosts.1',
        message: 'Expected supported host id to be a non-empty string.',
      },
      {
        path: 'supportedHosts.2',
        message: `Duplicate supported host id "${hostId}".`,
      },
      {
        path: 'supportedHosts.3',
        message: 'Expected supported host id to be a non-empty string.',
      },
    ]);
  });

  it('should report a host when it contains a separator', () => {
    driver.when.validated(anAppManifest({ supportedHosts: ['host/admin'] }));

    expect(driver.get.issues()).toEqual([
      {
        path: 'supportedHosts.0',
        message:
          'Expected supported host id to contain only letters, numbers, dots, dashes, and underscores, without traversal.',
      },
    ]);
  });

  it('should report supportedHosts when the wildcard is mixed with named hosts', () => {
    driver.when.validated(
      anAppManifest({ supportedHosts: ['*', faker.string.uuid()] }),
    );

    expect(driver.get.issues()).toEqual([
      {
        path: 'supportedHosts',
        message: 'Expected "*" to be the only supported host when present.',
      },
    ]);
  });

  it('should report placements when it is not an array', () => {
    driver.when.validated({ ...anAppManifest(), placements: {} });

    expect(driver.get.issues()).toEqual([
      { path: 'placements', message: 'Expected placements to be an array.' },
    ]);
  });

  it('should report id, hostId and kind when a placement is not an object', () => {
    driver.when.validated({
      ...anAppManifest(),
      supportedHosts: ['*'],
      placements: ['x'],
    });

    expect(driver.get.issuePaths()).toEqual([
      'placements.0.id',
      'placements.0.hostId',
      'placements.0.kind',
    ]);
  });

  it('should report only the missing hostId when a placement omits it', () => {
    const { hostId: _hostId, ...placement } = aSlotPlacement();
    driver.when.validated({
      ...anAppManifest(),
      supportedHosts: ['*'],
      placements: [placement],
    });

    expect(driver.get.issues()).toEqual([
      {
        path: 'placements.0.hostId',
        message: 'Expected hostId to be a non-empty string.',
      },
    ]);
  });

  it('should report nothing when a route and a slot target a supported host', () => {
    const hostId = faker.string.uuid();
    driver.when.validated(
      anAppManifest({
        placements: [aRoutePlacement({ hostId }), aSlotPlacement({ hostId })],
      }),
    );

    expect(driver.get.issues()).toEqual([]);
  });

  it('should report nothing when a placement targets the wildcard host and supportedHosts is the wildcard', () => {
    driver.when.validated(
      anAppManifest({ placements: [aSlotPlacement({ hostId: '*' })] }),
    );

    expect(driver.get.issues()).toEqual([]);
  });

  it('should report nothing when supportedHosts is the wildcard and a placement names a host', () => {
    driver.when.validated(
      anAppManifest({
        supportedHosts: ['*'],
        placements: [aSlotPlacement()],
      }),
    );

    expect(driver.get.issues()).toEqual([]);
  });

  it('should report the placement host when it is not in supportedHosts', () => {
    const hostId = faker.string.uuid();
    driver.when.validated(
      anAppManifest({
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

  it('should report id and hostId when they contain separators', () => {
    driver.when.validated(
      anAppManifest({
        supportedHosts: ['*'],
        placements: [aSlotPlacement({ id: '../main', hostId: 'host/admin' })],
      }),
    );

    expect(driver.get.issuePaths()).toEqual([
      'placements.0.id',
      'placements.0.hostId',
    ]);
  });

  it('should report kind when it is unknown', () => {
    driver.when.validated({
      ...anAppManifest({ supportedHosts: ['*'] }),
      placements: [{ ...aSlotPlacement(), kind: 'overlay' }],
    });

    expect(driver.get.issues()).toEqual([
      {
        path: 'placements.0.kind',
        message: 'Expected kind to be route or slot.',
      },
    ]);
  });

  it('should report the second id when two placements share id and host', () => {
    const hostId = faker.string.uuid();
    const id = faker.string.uuid();
    driver.when.validated(
      anAppManifest({
        placements: [
          aSlotPlacement({ id, hostId }),
          aSlotPlacement({ id, hostId }),
        ],
      }),
    );

    expect(driver.get.issues()).toEqual([
      {
        path: 'placements.1.id',
        message: `Duplicate mount id "${id}" for host "${hostId}". Mount ids only need to be unique within the same host. If this came from atlas.config.ts slots, do not repeat the same slotId for the same hostId; use a different slotId or hostId.`,
      },
    ]);
  });

  it('should report nothing when two placements share an id on different hosts', () => {
    const id = faker.string.uuid();
    driver.when.validated(
      anAppManifest({
        placements: [aSlotPlacement({ id }), aSlotPlacement({ id })],
      }),
    );

    expect(driver.get.issues()).toEqual([]);
  });

  it('should report slot when it is missing', () => {
    const { slot: _slot, ...placement } = aSlotPlacement();
    driver.when.validated(anAppManifest({ placements: [placement] }));

    expect(driver.get.issues()).toEqual([
      {
        path: 'placements.0.slot',
        message: 'Expected slot to be a non-empty string.',
      },
    ]);
  });

  it('should report route when a slot placement defines one', () => {
    driver.when.validated(
      anAppManifest({
        placements: [aSlotPlacement({ route: aRouteContribution() })],
      }),
    );

    expect(driver.get.issues()).toEqual([
      {
        path: 'placements.0.route',
        message: 'Slot placements must not define a route.',
      },
    ]);
  });

  it('should report route when route details are missing', () => {
    const { route: _route, ...placement } = aRoutePlacement();
    driver.when.validated(anAppManifest({ placements: [placement] }));

    expect(driver.get.issues()).toEqual([
      {
        path: 'placements.0.route',
        message: 'Expected route details for a route placement.',
      },
    ]);
  });

  it('should report slot when a route placement defines one', () => {
    driver.when.validated(
      anAppManifest({
        placements: [aRoutePlacement({ slot: faker.lorem.word() })],
      }),
    );

    expect(driver.get.issues()).toEqual([
      {
        path: 'placements.0.slot',
        message: 'Route placements must not define a slot.',
      },
    ]);
  });

  it('should report path when it is not a route pattern', () => {
    driver.when.validated(
      anAppManifest({
        placements: [
          aRoutePlacement({
            route: aRouteContribution({ path: 'orders?tab=1' }),
          }),
        ],
      }),
    );

    expect(driver.get.issues()).toEqual([
      {
        path: 'placements.0.route.path',
        message:
          'Expected an absolute route pattern with static segments, :params, or a final * wildcard.',
      },
    ]);
  });

  it('should report title, nav label, order and visible when they have wrong types', () => {
    driver.when.validated({
      ...anAppManifest({ supportedHosts: ['*'] }),
      placements: [
        {
          ...aRoutePlacement(),
          route: {
            ...aRouteContribution(),
            title: '',
            nav: { label: '', order: 'first', visible: 'yes' },
          },
        },
      ],
    });

    expect(driver.get.issues()).toEqual([
      {
        path: 'placements.0.route.title',
        message: 'Expected title to be a non-empty string.',
      },
      {
        path: 'placements.0.route.nav.label',
        message: 'Expected label to be a non-empty string.',
      },
      {
        path: 'placements.0.route.nav.order',
        message: 'Expected order to be a finite number.',
      },
      {
        path: 'placements.0.route.nav.visible',
        message: 'Expected visible to be a boolean.',
      },
    ]);
  });

  it('should report nav when it is not an object', () => {
    driver.when.validated({
      ...anAppManifest({ supportedHosts: ['*'] }),
      placements: [
        {
          ...aRoutePlacement(),
          route: { ...aRouteContribution(), nav: 'menu' },
        },
      ],
    });

    expect(driver.get.issues()).toEqual([
      {
        path: 'placements.0.route.nav',
        message: 'Expected nav to be an object.',
      },
    ]);
  });

  it('should report layoutId when it contains spaces', () => {
    driver.when.validated(
      anAppManifest({
        placements: [
          aRoutePlacement({
            route: aRouteContribution({ layoutId: 'invalid layout' }),
          }),
        ],
      }),
    );

    expect(driver.get.issues()).toEqual([
      {
        path: 'placements.0.route.layoutId',
        message:
          'Expected layout id to contain only letters, numbers, dots, dashes, and underscores, without traversal.',
      },
    ]);
  });

  it('should report match when it is unknown', () => {
    driver.when.validated({
      ...anAppManifest({ supportedHosts: ['*'] }),
      placements: [
        {
          ...aRoutePlacement(),
          route: { ...aRouteContribution(), match: 'exact' },
        },
      ],
    });

    expect(driver.get.issues()).toEqual([
      {
        path: 'placements.0.route.match',
        message: 'Expected match to be prefix or full.',
      },
    ]);
  });

  it('should report redirectTo when it is not an absolute route path', () => {
    driver.when.validated(
      anAppManifest({
        placements: [
          aRoutePlacement({
            route: aRouteContribution({ redirectTo: 'dashboard' }),
          }),
        ],
      }),
    );

    expect(driver.get.issues()).toEqual([
      {
        path: 'placements.0.route.redirectTo',
        message: 'Expected redirectTo to be an absolute route path.',
      },
    ]);
  });

  it('should report layoutId when a redirect route defines one', () => {
    driver.when.validated(
      anAppManifest({
        placements: [
          aRoutePlacement({
            route: aRouteContribution({
              redirectTo: '/dashboard',
              layoutId: faker.string.uuid(),
            }),
          }),
        ],
      }),
    );

    expect(driver.get.issues()).toEqual([
      {
        path: 'placements.0.route.layoutId',
        message: 'Redirect routes must not define layoutId.',
      },
    ]);
  });

  it('should report the second path when two routes on one host differ only by trailing slash', () => {
    const hostId = faker.string.uuid();
    driver.when.validated(
      anAppManifest({
        placements: [
          aRoutePlacement({
            hostId,
            route: aRouteContribution({ path: '/orders' }),
          }),
          aRoutePlacement({
            hostId,
            route: aRouteContribution({ path: '/orders/' }),
          }),
        ],
      }),
    );

    expect(driver.get.issues()).toEqual([
      {
        path: 'placements.1.route.path',
        message: `Duplicate route path "/orders" for host "${hostId}". In atlas.config.ts routes, each hostId can use a path only once. Use a different path or hostId.`,
      },
    ]);
  });

  it('should report nothing when two routes share a path on different hosts', () => {
    const path = '/orders';
    driver.when.validated(
      anAppManifest({
        placements: [
          aRoutePlacement({ route: aRouteContribution({ path }) }),
          aRoutePlacement({ route: aRouteContribution({ path }) }),
        ],
      }),
    );

    expect(driver.get.issues()).toEqual([]);
  });

  it('should report exportedWidgets when it is not an array', () => {
    driver.when.validated({ ...anAppManifest(), exportedWidgets: {} });

    expect(driver.get.issues()).toEqual([
      {
        path: 'exportedWidgets',
        message: 'Expected exportedWidgets to be an array.',
      },
    ]);
  });

  it('should report nothing when the widget belongs to the app and shares its framework', () => {
    const manifest = anAppManifest();
    driver.when.validated({
      ...manifest,
      exportedWidgets: [
        anExportedWidgetManifest({
          ownerAppId: manifest.id,
          framework: manifest.framework,
        }),
      ],
    });

    expect(driver.get.issues()).toEqual([]);
  });

  it('should report ownerAppId when it differs from the app id', () => {
    const manifest = anAppManifest();
    driver.when.validated({
      ...manifest,
      exportedWidgets: [
        anExportedWidgetManifest({ framework: manifest.framework }),
      ],
    });

    expect(driver.get.issues()).toEqual([
      {
        path: 'exportedWidgets.0.ownerAppId',
        message: 'Expected ownerAppId to match the app id.',
      },
    ]);
  });

  it('should report framework when it differs from the app framework', () => {
    const manifest = anAppManifest({ framework: 'react' });
    driver.when.validated({
      ...manifest,
      exportedWidgets: [
        anExportedWidgetManifest({
          ownerAppId: manifest.id,
          framework: 'angular',
        }),
      ],
    });

    expect(driver.get.issues()).toEqual([
      {
        path: 'exportedWidgets.0.framework',
        message: 'Expected framework to match the app framework.',
      },
    ]);
  });

  it('should report schemaVersion, contractVersion, id, remoteEntryUrl and metadata when they are invalid', () => {
    const manifest = anAppManifest();
    driver.when.validated({
      ...manifest,
      exportedWidgets: [
        {
          ...anExportedWidgetManifest(),
          ownerAppId: manifest.id,
          framework: manifest.framework,
          schemaVersion: '2',
          contractVersion: '2',
          id: '../summary',
          remoteEntryUrl: 'javascript:alert(1)',
          metadata: { invalid: null },
        },
      ],
    });

    expect(driver.get.issuePaths()).toEqual([
      'exportedWidgets.0.schemaVersion',
      'exportedWidgets.0.contractVersion',
      'exportedWidgets.0.id',
      'exportedWidgets.0.remoteEntryUrl',
      'exportedWidgets.0.metadata.invalid',
    ]);
  });

  it('should report the second id when two widgets share one', () => {
    const manifest = anAppManifest();
    const widget = anExportedWidgetManifest({
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

  it('should report externalAppsDependencies when it is not an array', () => {
    driver.when.validated({
      ...anAppManifest(),
      externalAppsDependencies: 'maps',
    });

    expect(driver.get.issues()).toEqual([
      {
        path: 'externalAppsDependencies',
        message: 'Expected externalAppsDependencies to be an array.',
      },
    ]);
  });

  it('should report nothing when every dependency is a unique identifier', () => {
    driver.when.validated(
      anAppManifest({
        externalAppsDependencies: [faker.string.uuid(), faker.string.uuid()],
      }),
    );

    expect(driver.get.issues()).toEqual([]);
  });

  it('should report non-string, unsafe and duplicate entries when present', () => {
    const appId = faker.string.uuid();
    driver.when.validated({
      ...anAppManifest(),
      externalAppsDependencies: [4, 'maps app', appId, appId],
    });

    expect(driver.get.issues()).toEqual([
      {
        path: 'externalAppsDependencies.0',
        message: 'Expected an external app id.',
      },
      {
        path: 'externalAppsDependencies.1',
        message:
          'Expected external app id to contain only letters, numbers, dots, dashes, and underscores, without traversal.',
      },
      {
        path: 'externalAppsDependencies.3',
        message: `Duplicate external app dependency "${appId}".`,
      },
    ]);
  });
});
