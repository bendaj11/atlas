/** @jest-environment jsdom */

import { faker } from '@faker-js/faker';
import { anAppManifest, aSlotPlacement } from '@atlas/testkit';
import { DomHostDriver } from './dom-host.driver.js';

describe('startDomHost', () => {
  let driver: DomHostDriver;

  beforeEach(() => {
    driver = new DomHostDriver();
  });

  describe('when the catalog matches the configured host', () => {
    beforeEach(async () => {
      await driver.when.started();
    });

    it('should return the runtime for the configured host when started', () => {
      expect(driver.get.error()).toBeUndefined();
    });

    it('should emit host.start then host.ready when started', () => {
      expect(driver.get.eventTypes()).toEqual(['host.start', 'host.ready']);
    });

    it('should call onReady once when started without host anchors', () => {
      expect(driver.get.onReadyMock()).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the catalog matches the configured host and a status anchor is registered', () => {
    beforeEach(async () => {
      await driver.given.statusAnchor().when.started();
    });

    it('should leave the status anchor without a host status when started', () => {
      expect(driver.get.hostStatuses()).toHaveLength(0);
    });

    it('should call onReady once when started', () => {
      expect(driver.get.onReadyMock()).toHaveBeenCalledTimes(1);
    });
  });

  it('should call onReady before the runtime starts when a slot app placement enters loading', async () => {
    const slot = faker.word.noun();
    driver.given
      .slotAnchor(slot)
      .given.catalogApps([
        anAppManifest({
          channel: 'production',
          supportedHosts: [driver.hostId],
          remoteEntryUrl:
            'http://localhost:4173/atlas/apps/widget/remoteEntry.json',
          placements: [aSlotPlacement({ hostId: driver.hostId, slot })],
        }),
      ])
      .given.remoteModuleLoad(new Promise(() => undefined));

    await driver.when.startRequested();

    expect(driver.get.onReadyMock()).toHaveBeenCalledTimes(1);
  });

  describe('when the catalog belongs to another host and a status anchor is registered', () => {
    beforeEach(async () => {
      await driver.given
        .statusAnchor()
        .given.catalogForOtherHost()
        .when.started();
    });

    it('should reject with the catalog mismatch code prefixed by the start failure when started', () => {
      expect(driver.get.error()).toMatchObject({
        code: 'ATLAS_CATALOG_HOST_MISMATCH',
        message: expect.stringContaining(
          'Atlas could not start this page: Atlas cannot start host',
        ),
      });
    });

    it('should keep the catalog mismatch error as cause when started', () => {
      expect(driver.get.error()).toMatchObject({
        cause: { code: 'ATLAS_CATALOG_HOST_MISMATCH' },
      });
    });

    it('should render the error state in the status anchor when started', () => {
      expect(driver.get.statusState()).toBe('error');
    });

    it('should call onReady once after the error shows when started', () => {
      expect(driver.get.onReadyMock()).toHaveBeenCalledTimes(1);
    });

    it('should emit host.start then host.error when started', () => {
      expect(driver.get.eventTypes()).toEqual(['host.start', 'host.error']);
    });

    it('should log the start failure when started', () => {
      expect(driver.get.consoleErrorMock()).toHaveBeenCalledWith(
        'Atlas host failed to start.',
        expect.objectContaining({ code: 'ATLAS_CATALOG_HOST_MISMATCH' }),
      );
    });
  });

  describe('when creating the navigation fails once and a status anchor is registered', () => {
    beforeEach(async () => {
      await driver.given
        .statusAnchor()
        .given.navigationFailingOnce(new Error('router not ready'))
        .when.started();
    });

    it('should reject with ATLAS_HOST_START_FAILED carrying the cause message when started', () => {
      expect(driver.get.error()).toMatchObject({
        code: 'ATLAS_HOST_START_FAILED',
        message: expect.stringContaining('router not ready'),
      });
    });

    it('should remove the host status when retry succeeds', async () => {
      await driver.when.retryClicked();

      expect(driver.get.hostStatuses()).toHaveLength(0);
    });

    it('should call onReady again when retry succeeds', async () => {
      await driver.when.retryClicked();

      expect(driver.get.onReadyMock()).toHaveBeenCalledTimes(2);
    });

    it('should emit host.ready when retry succeeds', async () => {
      await driver.when.retryClicked();

      expect(driver.get.eventTypes()).toEqual([
        'host.start',
        'host.error',
        'host.start',
        'host.ready',
      ]);
    });
  });

  describe('when the first navigation fails, the retried navigation stays pending and a status anchor is registered', () => {
    beforeEach(async () => {
      await driver.given
        .statusAnchor()
        .given.navigationFailingOnce(new Error(faker.lorem.sentence()))
        .given.navigationLoadOnce(new Promise(() => undefined))
        .when.started();
    });

    it('should keep the error in the status anchor when retry is pending', async () => {
      await driver.when.retryClicked();

      expect(driver.get.statusState()).toBe('error');
    });

    it('should create the navigation once more when retry is clicked twice', async () => {
      await driver.when.retryClicked();
      await driver.when.retryClicked();

      expect(driver.get.createNavigationMock()).toHaveBeenCalledTimes(2);
    });
  });

  it('should call the ui host error renderer with the error when the catalog belongs to another host', async () => {
    await driver.given
      .customHostError(true)
      .given.catalogForOtherHost()
      .when.started();

    expect(driver.get.renderHostErrorMock()).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      driver.get.error(),
      expect.any(Function),
    );
  });

  it('should show a single host status when the retry fails again with a status anchor registered', async () => {
    await driver.given
      .statusAnchor()
      .given.navigationFailingOnce(new Error(faker.lorem.sentence()))
      .given.navigationFailingOnce(new Error(faker.lorem.sentence()))
      .when.started();

    await driver.when.retryClicked();

    expect(driver.get.hostStatuses()).toHaveLength(1);
  });
});
