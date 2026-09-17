import { faker } from '@faker-js/faker';
import { aHostManifest } from '@atlas/testkit';
import { BuildNotificationsDriver } from './build-notifications.driver.js';

describe('watchHostBuildNotifications', () => {
  let driver: BuildNotificationsDriver;

  beforeEach(() => {
    driver = new BuildNotificationsDriver();
  });

  it('should not open an event source when the remote declares no endpoint', () => {
    driver.when.watched({ metadata: {}, manifest: aHostManifest() });

    expect(driver.get.eventSourceUrl()).toBeUndefined();
  });

  describe('when the remote declares a build notifications endpoint', () => {
    const manifest = aHostManifest();
    const buildNotificationsEndpoint = `./${faker.lorem.slug()}`;

    it('should not open an event source when event sources are unsupported', () => {
      driver.given
        .eventSourceSupported(false)
        .when.watched({ metadata: { buildNotificationsEndpoint }, manifest });

      expect(driver.get.eventSourceUrl()).toBeUndefined();
    });

    describe('when event sources are supported', () => {
      beforeEach(() => {
        driver.given
          .eventSourceSupported(true)
          .when.watched({ metadata: { buildNotificationsEndpoint }, manifest });
      });

      it('should open the endpoint relative to the remote entry when watched', () => {
        expect(driver.get.eventSourceUrl()).toEqual(
          new URL(buildNotificationsEndpoint, manifest.remoteEntryUrl),
        );
      });

      it('should reload the page when a federation rebuild completes', () => {
        driver.when.notified(
          JSON.stringify({ type: 'federation-rebuild-complete' }),
        );

        expect(driver.get.reloadPageMock()).toHaveBeenCalledTimes(1);
      });

      it('should keep the page when another notification arrives', () => {
        driver.when.notified(JSON.stringify({ type: faker.lorem.slug() }));

        expect(driver.get.reloadPageMock()).not.toHaveBeenCalled();
      });

      it('should keep the page when the notification is not JSON', () => {
        driver.when.notified(faker.lorem.word());

        expect(driver.get.reloadPageMock()).not.toHaveBeenCalled();
      });
    });
  });
});
