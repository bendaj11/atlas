import { faker } from '@faker-js/faker';
import { aStylesheet, anExportedWidgetManifest } from '@atlas/testkit';
import { aSha256Integrity } from '@atlas/testkit/internal';
import { ATLAS_VERSION_CHANNELS } from '../atlas-version-channel.js';
import { CreateManifestFromConfigDriver } from './create-manifest-from-config.driver.js';

describe('createManifestFromConfig', () => {
  let driver: CreateManifestFromConfigDriver;

  beforeEach(() => {
    driver = new CreateManifestFromConfigDriver();
  });

  it('should write fixed schema fields when created', () => {
    driver.when.created();

    expect(driver.get.manifest()).toMatchObject({
      schemaVersion: '1',
      kind: 'app',
      exposes: { entry: './entry' },
    });
  });

  it('should default channel to production when omitted', () => {
    driver.when.created();

    expect(driver.get.manifest().channel).toBe('production');
  });

  it('should default isolation to shadow-dom when config omits domIsolation', () => {
    driver.when.created();

    expect(driver.get.manifest().isolation).toBe('shadow-dom');
  });

  it('should default requiredHostSdkVersion to ^0.1.0 when config omits it', () => {
    driver.when.created();

    expect(driver.get.manifest().requiredHostSdkVersion).toBe('^0.1.0');
  });

  it('should use the id as name when config omits name', () => {
    const id = faker.string.uuid();
    driver.given.config({ id }).when.created();

    expect(driver.get.manifest().name).toBe(id);
  });

  it('should use the wildcard host when no routes or slots are configured', () => {
    driver.when.created();

    expect(driver.get.manifest().supportedHosts).toEqual(['*']);
  });

  it('should write createdAt as ISO time when omitted', () => {
    driver.when.created();

    expect(driver.get.manifest().createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('should omit optional fields when input omits them', () => {
    driver.when.created();

    expect(Object.keys(driver.get.manifest())).toEqual([
      'schemaVersion',
      'kind',
      'id',
      'name',
      'version',
      'buildId',
      'channel',
      'framework',
      'isolation',
      'remoteEntryUrl',
      'exposes',
      'requiredHostSdkVersion',
      'supportedHosts',
      'placements',
      'createdAt',
    ]);
  });

  it.each(ATLAS_VERSION_CHANNELS)(
    'should write channel %s when given',
    (channel) => {
      driver.given.input({ channel }).when.created();

      expect(driver.get.manifest().channel).toBe(channel);
    },
  );

  it('should pass through identity, name, isolation and sdk range when given', () => {
    const config = {
      id: faker.string.uuid(),
      name: faker.commerce.productName(),
      framework: 'angular' as const,
      domIsolation: 'shared-dom' as const,
      requiredHostSdkVersion: `~${faker.system.semver()}`,
    };
    const input = {
      version: faker.system.semver(),
      buildId: faker.string.uuid(),
      remoteEntryUrl: faker.internet.url(),
      createdAt: faker.date.past().toISOString(),
    };
    driver.given.config(config).given.input(input).when.created();

    expect(driver.get.manifest()).toMatchObject({
      id: config.id,
      name: config.name,
      framework: config.framework,
      isolation: config.domIsolation,
      requiredHostSdkVersion: config.requiredHostSdkVersion,
      ...input,
    });
  });

  it('should pass through git, integrity, styles and exported widgets when given', () => {
    const id = faker.string.uuid();
    const framework = 'vue' as const;
    const input = {
      gitSha: faker.git.commitSha(),
      gitBranch: faker.git.branch(),
      gitCommitTitle: faker.git.commitMessage(),
      prNumber: faker.number.int({ min: 1, max: 999 }),
      integrity: aSha256Integrity(),
      styles: [aStylesheet()],
      exportedWidgets: [
        anExportedWidgetManifest({ ownerAppId: id, framework }),
      ],
    };
    driver.given.config({ id, framework }).given.input(input).when.created();

    expect(driver.get.manifest()).toMatchObject(input);
  });

  it('should dedupe externalAppsDependencies when config repeats one', () => {
    const [first, second] = [faker.string.uuid(), faker.string.uuid()];
    driver.given
      .config({ externalAppsDependencies: [first, second, first] })
      .when.created();

    expect(driver.get.manifest().externalAppsDependencies).toEqual([
      first,
      second,
    ]);
  });

  it('should derive supportedHosts from route and slot hosts when configured', () => {
    const [routeHost, slotHost] = [faker.string.uuid(), faker.string.uuid()];
    driver.given
      .config({
        routes: [{ hostId: routeHost, path: '/catalog' }],
        slots: [{ slotId: faker.lorem.slug(), hostId: slotHost }],
      })
      .when.created();

    expect(driver.get.manifest().supportedHosts).toEqual([routeHost, slotHost]);
  });

  it('should write a route placement with only the given route fields when a route is configured', () => {
    const hostId = faker.string.uuid();
    driver.given
      .config({ routes: [{ hostId, path: '/catalog', title: 'Catalog' }] })
      .when.created();

    expect(driver.get.manifest().placements).toEqual([
      {
        id: `${hostId}-catalog-route`,
        kind: 'route',
        hostId,
        route: { path: '/catalog', title: 'Catalog' },
      },
    ]);
  });

  it('should copy match, redirectTo, layoutId and nav when a route defines them', () => {
    const hostId = faker.string.uuid();
    const route = {
      hostId,
      path: '/',
      match: 'full' as const,
      redirectTo: '/dashboard',
      title: faker.lorem.words(),
      nav: {
        label: faker.lorem.word(),
        order: faker.number.int({ max: 9 }),
        visible: true,
      },
    };
    driver.given.config({ routes: [route] }).when.created();

    expect(driver.get.manifest().placements[0]?.route).toEqual({
      path: '/',
      match: 'full',
      redirectTo: '/dashboard',
      title: route.title,
      nav: route.nav,
    });
  });

  it('should copy layoutId when a route defines one', () => {
    const layoutId = faker.string.uuid();
    driver.given
      .config({
        routes: [{ hostId: faker.string.uuid(), path: '/catalog', layoutId }],
      })
      .when.created();

    expect(driver.get.manifest().placements[0]?.route).toEqual({
      path: '/catalog',
      layoutId,
    });
  });

  it('should write a slot placement when a slot is configured', () => {
    const hostId = faker.string.uuid();
    driver.given
      .config({ slots: [{ slotId: 'sidebar', hostId }] })
      .when.created();

    expect(driver.get.manifest().placements).toEqual([
      { id: `${hostId}-sidebar-slot`, kind: 'slot', hostId, slot: 'sidebar' },
    ]);
  });

  it('should suffix later placement ids when routes normalize to the same id', () => {
    const hostId = faker.string.uuid();
    driver.given
      .config({
        routes: [
          { hostId, path: '/orders/:id' },
          { hostId, path: '/orders/id' },
        ],
      })
      .when.created();

    expect(
      driver.get.manifest().placements.map((placement) => placement.id),
    ).toEqual([`${hostId}-orders-id-route`, `${hostId}-orders-id-route-2`]);
  });

  it('should scope slot ids by host when two hosts share a slot name', () => {
    const [first, second] = [faker.string.uuid(), faker.string.uuid()];
    driver.given
      .config({
        slots: [
          { hostId: first, slotId: 'window' },
          { hostId: second, slotId: 'window' },
        ],
      })
      .when.created();

    expect(
      driver.get.manifest().placements.map((placement) => placement.id),
    ).toEqual([`${first}-window-slot`, `${second}-window-slot`]);
  });

  it('should throw the manifest validation error when the config produces duplicate routes', () => {
    const hostId = faker.string.uuid();
    driver.given.config({
      routes: [
        { hostId, path: '/orders' },
        { hostId, path: '/orders/' },
      ],
    });

    expect(() => driver.when.created()).toThrow(
      `Duplicate route path "/orders" for host "${hostId}"`,
    );
  });
});
