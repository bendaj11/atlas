/** @jest-environment jsdom */

import { faker } from '@faker-js/faker';
import { anAppManifest, aRoutePlacement, aSlotPlacement } from '@atlas/testkit';
import { DomHostRuntimeDriver } from './dom-host-runtime.driver.js';

describe('startDomHostRuntime', () => {
  let driver: DomHostRuntimeDriver;

  beforeEach(() => {
    driver = new DomHostRuntimeDriver();
  });

  it('should reject with ATLAS_CATALOG_HOST_MISMATCH when the catalog belongs to another host', async () => {
    await driver.given.catalogForHost(faker.string.uuid()).when.started();

    expect(driver.get.error()).toMatchObject({
      code: 'ATLAS_CATALOG_HOST_MISMATCH',
    });
  });

  it('should call onInfrastructureReady before mounting apps when started', async () => {
    await driver.when.started();

    expect(driver.get.onInfrastructureReadyMock()).toHaveBeenCalledTimes(1);
  });

  describe('when the catalog selects a production app with a slot placement', () => {
    const slot = faker.word.noun();

    beforeEach(() => {
      driver.given.catalogApps([
        anAppManifest({
          channel: 'production',
          supportedHosts: [driver.hostId],
          remoteEntryUrl:
            'http://localhost:4173/atlas/apps/widget/remoteEntry.json',
          placements: [aSlotPlacement({ hostId: driver.hostId, slot })],
        }),
      ]);
    });

    it('should not load the remote module when the slot anchor is missing at start', async () => {
      await driver.when.started();

      expect(driver.get.loadRemoteModuleMock()).not.toHaveBeenCalled();
    });

    it('should initialize the slot app remote when the slot anchor is missing at start', async () => {
      await driver.when.started();

      expect(driver.get.initializedRemoteUrls()).toEqual([
        'http://localhost:4173/atlas/apps/widget/remoteEntry.json',
      ]);
    });

    it('should load the remote module when the slot anchor is registered after start', async () => {
      await driver.when.started();

      await driver.when.slotAnchorRegistered(slot);

      expect(driver.get.loadRemoteModuleMock()).toHaveBeenCalledTimes(1);
    });

    it('should report app.state events to the observer when the slot app mounts', async () => {
      driver.given.slotAnchor(slot);

      await driver.when.started();

      expect(driver.get.appStates()).toEqual(['loading', 'mounted']);
    });

    it('should call onPlacementStateChange for each slot app state when the slot app mounts', async () => {
      driver.given.slotAnchor(slot);

      await driver.when.started();

      expect(driver.get.onPlacementStateChangeMock()).toHaveBeenCalledTimes(2);
    });

    it('should call the ui loading renderer with the loading event when the slot app mounts', async () => {
      driver.given.slotAnchor(slot);

      await driver.when.started();

      expect(driver.get.renderLoadingMock()).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({ state: 'loading' }),
      );
    });

    it('should log the root load error code and cause message when the remote module fails to load', async () => {
      driver.given
        .slotAnchor(slot)
        .given.remoteModuleFailing(new Error('CDN unavailable'));

      await driver.when.started();

      expect(driver.get.consoleErrorMock()).toHaveBeenCalledWith(
        expect.stringContaining('failed to load'),
        expect.objectContaining({
          code: 'ATLAS_RESOURCE_LOAD_FAILED',
          message: expect.stringContaining('CDN unavailable'),
        }),
      );
    });
  });

  describe('when the catalog selects a production app with a visible route', () => {
    const label = faker.commerce.productName();

    beforeEach(() => {
      driver.given
        .catalogApps([
          anAppManifest({
            channel: 'production',
            supportedHosts: [driver.hostId],
            remoteEntryUrl:
              'http://localhost:4173/atlas/apps/orders/remoteEntry.json',
            placements: [
              aRoutePlacement({
                hostId: driver.hostId,
                route: { path: '/orders', nav: { label } },
              }),
            ],
          }),
        ])
        .given.navigationAnchor();
    });

    it('should render the navigation items into the navigation anchor when started', async () => {
      await driver.when.started();

      expect(driver.get.navigationLinkLabels()).toEqual([label]);
    });

    it('should render the navigation items into a navigation anchor registered after start', async () => {
      await driver.when.started();

      await driver.when.navigationAnchorRegistered();

      expect(driver.get.navigationLinkLabels()).toEqual([label]);
    });

    it('should call onNavigationChange with the items when started', async () => {
      await driver.when.started();

      expect(
        driver.get.lastNavigationItems().map((item) => item.label),
      ).toEqual([label]);
    });

    it('should mark the route as not found when started on a path no route matches', async () => {
      await driver.when.started();

      expect(driver.get.routeNotFound()).toBe(true);
    });

    it('should clear the not found route when navigation moves to the route path', async () => {
      await driver.when.started();

      await driver.when.navigatedTo('/orders');

      expect(driver.get.routeNotFound()).toBe(false);
    });

    it('should report the route item as active when navigation moves to its path', async () => {
      await driver.when.started();

      await driver.when.navigatedTo('/orders');

      expect(driver.get.lastNavigationItems()[0]?.active).toBe(true);
    });

    it('should stop reporting navigation items when stopped before navigation changes', async () => {
      await driver.when.started();

      await driver.when.stopped();
      await driver.when.navigatedTo('/orders');

      expect(driver.get.lastNavigationItems()[0]?.active).toBe(false);
    });
  });
});
