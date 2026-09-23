/** @jest-environment jsdom */

import { faker } from '@faker-js/faker';
import { anAppManifest, aRoutePlacement, aSlotPlacement } from '@atlas/testkit';
import { HostRuntimeDriver } from './host-runtime.driver.js';

describe('startAtlasHostRuntime', () => {
  let driver: HostRuntimeDriver;

  beforeEach(() => {
    driver = new HostRuntimeDriver();
  });

  describe('when two production apps declare nested routes for the host', () => {
    beforeEach(async () => {
      driver.given.manifests([
        anAppManifest({
          id: 'catalog',
          channel: 'production',
          placements: [
            aRoutePlacement({
              hostId: driver.hostId,
              route: { path: '/catalog' },
            }),
          ],
        }),
        anAppManifest({
          id: 'details',
          channel: 'production',
          placements: [
            aRoutePlacement({
              hostId: driver.hostId,
              route: { path: '/catalog/details' },
            }),
          ],
        }),
      ]);

      await driver.when.started();
    });

    it('should mount nothing when the current path matches no route', () => {
      expect(driver.get.states()).toEqual([]);
    });

    it('should mount the app of the matching route when navigated to its path', async () => {
      await driver.when.navigatedTo('/catalog');

      expect(driver.get.states('catalog')).toEqual(['mounting', 'mounted']);
    });

    it('should unmount the previous app when navigated to the longer route', async () => {
      await driver.when.navigatedTo('/catalog');

      await driver.when.navigatedTo('/catalog/details/42');

      expect(driver.get.unmountsMock()).toHaveBeenCalledWith('catalog');
    });

    it('should import only the apps of visited routes when navigated twice', async () => {
      await driver.when.navigatedTo('/catalog');

      await driver.when.navigatedTo('/catalog/details/42');

      expect(driver.get.importsMock().mock.calls).toEqual([
        ['catalog'],
        ['details'],
      ]);
    });

    it('should unmount the active app when stopped', async () => {
      await driver.when.navigatedTo('/catalog/details');

      await driver.when.stopped();

      expect(driver.get.unmountsMock()).toHaveBeenCalledWith('details');
    });
  });

  describe('when a slow app route is left before its mount completes', () => {
    beforeEach(async () => {
      driver.given
        .manifests([
          anAppManifest({
            id: 'slow',
            channel: 'production',
            placements: [
              aRoutePlacement({
                hostId: driver.hostId,
                route: { path: '/slow' },
              }),
            ],
          }),
          anAppManifest({
            id: 'latest',
            channel: 'production',
            placements: [
              aRoutePlacement({
                hostId: driver.hostId,
                route: { path: '/latest' },
              }),
            ],
          }),
        ])
        .given.mountBlockedFor('slow');

      await driver.when.started();
      await driver.when.navigatedTo('/slow');
      await driver.when.navigatedTo('/latest');
    });

    it('should mount the latest app when navigated away from the pending route', () => {
      expect(driver.get.states('latest')).toEqual(['mounting', 'mounted']);
    });

    it('should unmount the slow app when its mount completes after being superseded', async () => {
      await driver.when.blockedMountReleased('slow');

      expect(driver.get.unmountsMock()).toHaveBeenCalledWith('slow');
    });
  });

  describe('when two apps claim the same route path', () => {
    beforeEach(async () => {
      driver.given.manifests([
        anAppManifest({
          id: 'first',
          channel: 'production',
          placements: [
            aRoutePlacement({
              hostId: driver.hostId,
              route: { path: '/orders' },
            }),
          ],
        }),
        anAppManifest({
          id: 'second',
          channel: 'production',
          placements: [
            aRoutePlacement({
              hostId: driver.hostId,
              route: { path: '/orders/' },
            }),
          ],
        }),
      ]);

      await driver.when.started();
    });

    it('should log ATLAS_DUPLICATE_ROUTE naming the route and host when started', () => {
      expect(driver.get.consoleErrorMock()).toHaveBeenCalledWith(
        'Atlas ignored a conflicting route.',
        expect.objectContaining({
          code: 'ATLAS_DUPLICATE_ROUTE',
          suggestedActions: [
            `Give route "/orders" to only one app for host "${driver.hostId}".`,
            'Update atlas.config.ts in the conflicting app, rebuild it, and republish its manifest.',
          ],
        }),
      );
    });

    it('should import only the first app when navigated to the shared route', async () => {
      await driver.when.navigatedTo('/orders');

      expect(driver.get.importsMock().mock.calls).toEqual([['first']]);
    });
  });

  it('should activate the layout of the matching route when navigated to a parameterized path', async () => {
    driver.given.manifests([
      anAppManifest({
        id: 'orders',
        channel: 'production',
        placements: [
          aRoutePlacement({
            hostId: driver.hostId,
            route: { path: '/orders', layoutId: 'standard' },
          }),
        ],
      }),
      anAppManifest({
        id: 'details',
        channel: 'production',
        placements: [
          aRoutePlacement({
            hostId: driver.hostId,
            route: { path: '/orders/:orderId', layoutId: 'detail' },
          }),
        ],
      }),
    ]);
    await driver.when.started();

    await driver.when.navigatedTo('/orders/42');

    expect(driver.get.setActiveLayoutMock().mock.calls).toEqual([
      ['default'],
      ['detail'],
    ]);
  });

  describe('when the root route redirects to a dashboard route', () => {
    beforeEach(async () => {
      driver.given.manifests([
        anAppManifest({
          id: 'root-redirect',
          channel: 'production',
          placements: [
            aRoutePlacement({
              hostId: driver.hostId,
              route: { path: '/', match: 'full', redirectTo: '/dashboard' },
            }),
          ],
        }),
        anAppManifest({
          id: 'dashboard',
          channel: 'production',
          placements: [
            aRoutePlacement({
              hostId: driver.hostId,
              route: { path: '/dashboard' },
            }),
          ],
        }),
      ]);

      await driver.when.started();
    });

    it('should replace the location with the redirect target when the root route is active', () => {
      expect(driver.get.currentPathname()).toBe('/dashboard');
    });

    it('should import only the dashboard app when the root route redirects', () => {
      expect(driver.get.importsMock().mock.calls).toEqual([['dashboard']]);
    });
  });

  describe('when a production app declares a slot placement whose anchor exists', () => {
    const slot = faker.word.noun();

    beforeEach(() => {
      driver.given
        .manifests([
          anAppManifest({
            id: 'widget',
            channel: 'production',
            placements: [aSlotPlacement({ hostId: driver.hostId, slot })],
          }),
        ])
        .given.slotAnchor(slot);
    });

    it('should report mounting then mounted when started', async () => {
      await driver.when.started();

      expect(driver.get.states('widget')).toEqual(['mounting', 'mounted']);
    });

    it('should report a loading state when the app shows loading during mount', async () => {
      driver.given.entryBehavior('widget', ({ context }) =>
        context.loading.show(),
      );

      await driver.when.started();

      expect(driver.get.states('widget')).toEqual([
        'mounting',
        'loading',
        'mounted',
      ]);
    });

    describe('when the remote import fails', () => {
      beforeEach(async () => {
        driver.given.importFailure(new Error('CDN unavailable'));

        await driver.when.started();
      });

      it('should report mounting then error when started', () => {
        expect(driver.get.states('widget')).toEqual(['mounting', 'error']);
      });

      it('should report a browser ATLAS_APP_MOUNT_FAILED error carrying the cause message when started', () => {
        expect(driver.get.lastError()).toMatchObject({
          code: 'ATLAS_APP_MOUNT_FAILED',
          surface: 'browser',
          message: expect.stringContaining('CDN unavailable'),
        });
      });

      it('should import the app once more when retried twice concurrently', async () => {
        await driver.when.retriedTwiceConcurrently('widget');

        expect(driver.get.importsMock()).toHaveBeenCalledTimes(2);
      });
    });

    describe('when the app opts into readiness and never becomes ready within the timeout', () => {
      beforeEach(async () => {
        driver.given
          .resourcesTimeoutMs(5)
          .given.entryBehavior('widget', ({ context }) => {
            context.loading.waitUntilReady();
          });

        await driver.when.started();
      });

      it('should report mounting, loading, then error when the readiness timeout elapses', () => {
        expect(driver.get.states('widget')).toEqual([
          'mounting',
          'loading',
          'error',
        ]);
      });

      it('should report ATLAS_APP_MOUNT_TIMEOUT naming readiness when the readiness timeout elapses', () => {
        expect(driver.get.lastError()).toMatchObject({
          code: 'ATLAS_APP_MOUNT_TIMEOUT',
          message: expect.stringContaining('did not mark itself ready'),
        });
      });

      it('should unmount the app when the readiness timeout elapses', () => {
        expect(driver.get.unmountsMock()).toHaveBeenCalledWith('widget');
      });
    });

    it('should unmount the app when its mount completes after the mount timeout', async () => {
      driver.given
        .resourcesTimeoutMs(2)
        .given.entryBehavior(
          'widget',
          () => new Promise((resolve) => setTimeout(resolve, 10)),
        );
      await driver.when.started();

      await driver.when.waited(15);

      expect(driver.get.unmountsMock()).toHaveBeenCalledWith('widget');
    });
  });

  it('should mount the slot app when its anchor is registered after start', async () => {
    const slot = faker.word.noun();
    driver.given.manifests([
      anAppManifest({
        id: 'widget',
        channel: 'production',
        placements: [aSlotPlacement({ hostId: driver.hostId, slot })],
      }),
    ]);
    await driver.when.started();

    await driver.when.slotAnchorRegistered(slot);

    expect(driver.get.states('widget')).toEqual(['mounting', 'mounted']);
  });

  it('should keep the slot app mounted when navigation changes after its anchor is registered', async () => {
    const slot = faker.word.noun();
    driver.given.manifests([
      anAppManifest({
        id: 'widget',
        channel: 'production',
        placements: [aSlotPlacement({ hostId: driver.hostId, slot })],
      }),
    ]);
    await driver.when.started();

    await driver.when.slotAnchorRegistered(slot);
    await driver.when.navigatedTo(`/${faker.word.noun()}`);

    expect(driver.get.unmountsMock()).not.toHaveBeenCalled();
  });

  it('should import both slot apps before either mount completes when two slots are declared', async () => {
    const first = faker.word.noun();
    const second = `${first}-second`;
    driver.given
      .manifests([
        anAppManifest({
          id: 'first',
          channel: 'production',
          placements: [aSlotPlacement({ hostId: driver.hostId, slot: first })],
        }),
        anAppManifest({
          id: 'second',
          channel: 'production',
          placements: [aSlotPlacement({ hostId: driver.hostId, slot: second })],
        }),
      ])
      .given.slotAnchor(first)
      .given.slotAnchor(second)
      .given.mountBlockedFor('first')
      .given.mountBlockedFor('second');
    void driver.when.started();

    await driver.when.waited(0);

    expect(driver.get.importsMock().mock.calls).toEqual([
      ['first'],
      ['second'],
    ]);
  });
});
