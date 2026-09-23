/** @jest-environment jsdom */

import { faker } from '@faker-js/faker';
import { anAppManifest, aRoutePlacement } from '@atlas/testkit';
import { HostNavigationDriver } from './host-navigation.driver.js';

describe('createHostNavigationItems', () => {
  let driver: HostNavigationDriver;

  beforeEach(() => {
    driver = new HostNavigationDriver();
  });

  describe('when the host has visible routes with nav order and a hidden route', () => {
    const hostId = faker.string.uuid();
    const catalog = anAppManifest({
      placements: [
        aRoutePlacement({
          hostId,
          route: { path: '/catalog', nav: { label: 'Catalog', order: 20 } },
        }),
      ],
    });
    const orders = anAppManifest({
      placements: [
        aRoutePlacement({
          hostId,
          route: { path: '/orders', nav: { label: 'Orders', order: 10 } },
        }),
      ],
    });
    const hidden = anAppManifest({
      placements: [
        aRoutePlacement({
          hostId,
          route: { path: '/hidden', nav: { label: 'Hidden', visible: false } },
        }),
      ],
    });

    beforeEach(() => {
      driver.given.hostId(hostId).given.manifests([catalog, orders, hidden]);
    });

    it('should order visible items by nav order when created', () => {
      driver.when.created();

      expect(driver.get.items().map((item) => item.label)).toEqual([
        'Orders',
        'Catalog',
      ]);
    });

    it('should order visible items by nav order when the legacy positional arguments are used', () => {
      driver.when.createdWithLegacyArguments();

      expect(driver.get.items().map((item) => item.label)).toEqual([
        'Orders',
        'Catalog',
      ]);
    });

    it('should mark the item active when the current path is under its route', () => {
      driver.given.currentPath('/orders/42').when.created();

      expect(driver.get.items().map((item) => item.active)).toEqual([
        true,
        false,
      ]);
    });

    it('should navigate to the route path when an item is navigated', () => {
      driver.when.created();

      driver.when.itemNavigated(0);

      expect(driver.get.navigateMock()).toHaveBeenCalledWith('/orders');
    });
  });

  it('should keep only the first app when two apps share a route path', () => {
    const hostId = faker.string.uuid();
    const first = anAppManifest({
      placements: [aRoutePlacement({ hostId, route: { path: '/orders' } })],
    });
    const second = anAppManifest({
      placements: [aRoutePlacement({ hostId, route: { path: '/orders/' } })],
    });
    driver.given.hostId(hostId).given.manifests([first, second]).when.created();

    expect(driver.get.items().map((item) => item.appId)).toEqual([first.id]);
  });

  it('should mark the item active when the current path matches a parameterized route', () => {
    const hostId = faker.string.uuid();
    driver.given
      .hostId(hostId)
      .given.manifests([
        anAppManifest({
          placements: [
            aRoutePlacement({ hostId, route: { path: '/users/:id' } }),
          ],
        }),
      ])
      .given.currentPath('/users/42')
      .when.created();

    expect(driver.get.items()[0]?.active).toBe(true);
  });

  it('should not mark the item active when a full-match route is only a prefix of the current path', () => {
    const hostId = faker.string.uuid();
    driver.given
      .hostId(hostId)
      .given.manifests([
        anAppManifest({
          placements: [
            aRoutePlacement({
              hostId,
              route: { path: '/catalog', match: 'full' },
            }),
          ],
        }),
      ])
      .given.currentPath('/catalog/x')
      .when.created();

    expect(driver.get.items()[0]?.active).toBe(false);
  });

  it('should fall back to the route title and then the app name when nav label is absent', () => {
    const hostId = faker.string.uuid();
    const titled = anAppManifest({
      placements: [
        aRoutePlacement({ hostId, route: { path: '/a', title: 'Titled' } }),
      ],
    });
    const untitled = anAppManifest({
      placements: [aRoutePlacement({ hostId, route: { path: '/b' } })],
    });
    driver.given
      .hostId(hostId)
      .given.manifests([titled, untitled])
      .when.created();

    expect(driver.get.items().map((item) => item.label)).toEqual([
      'Titled',
      untitled.name,
    ]);
  });

  it('should exclude placements that target another host when created', () => {
    driver.given
      .manifests([
        anAppManifest({
          placements: [aRoutePlacement({ route: { path: '/x' } })],
        }),
      ])
      .when.created();

    expect(driver.get.items()).toEqual([]);
  });
});

describe('publishAtlasNavigationItems', () => {
  let driver: HostNavigationDriver;

  beforeEach(() => {
    driver = new HostNavigationDriver();
  });

  describe('when items are created for one visible route', () => {
    const hostId = faker.string.uuid();

    beforeEach(() => {
      driver.given
        .hostId(hostId)
        .given.manifests([
          anAppManifest({ placements: [aRoutePlacement({ hostId })] }),
        ])
        .when.created();
    });

    it('should notify subscribers with the items when published', () => {
      driver.when.subscribed();

      driver.when.published();

      expect(driver.get.listenerMock()).toHaveBeenCalledWith(
        driver.get.items(),
      );
    });

    it('should expose the items to readers when published', () => {
      driver.when.published();

      expect(driver.get.readItems()).toBe(driver.get.items());
    });
  });
});
