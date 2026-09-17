import { faker } from '@faker-js/faker';
import { anAppManifest } from '@atlas/testkit';
import { aHostData } from '../../../testkit/host-data.testkit';
import {
  inspectHostRequest,
  loadArtifactVersionRequest,
} from '../../shared/messages/messages';
import { BadgeScriptDriver } from './badge-script.driver';

const ATLAS_PAGE_BODY =
  '<div id="atlas-host-root"></div><script src="/atlas.loader.js"></script>';
const WINDOW_EVENTS = ['focus', 'pageshow', 'storage'];

describe('badge-script', () => {
  let driver: BadgeScriptDriver;

  beforeEach(() => {
    driver = new BadgeScriptDriver();
  });

  describe('when the page is not an atlas host', () => {
    it('should publish zero overrides when started', async () => {
      await driver.when.started();

      expect(driver.get.publishedOverrideCounts()).toStrictEqual([0]);
    });

    it('should not poll when started', async () => {
      await driver.when.started();

      expect(driver.get.setInterval()).not.toHaveBeenCalled();
    });

    it('should publish the dark theme when the page prefers a dark color scheme', async () => {
      driver.given.darkColorScheme(true);

      await driver.when.started();

      expect(driver.get.publishedColorSchemes()).toStrictEqual(['dark']);
    });

    it('should publish the light theme when the page prefers a light color scheme', async () => {
      driver.given.darkColorScheme(false);

      await driver.when.started();

      expect(driver.get.publishedColorSchemes()).toStrictEqual(['light']);
    });

    it('should count the session overrides when session storage holds a document', async () => {
      driver.given.sessionStorageItem(
        'atlas.runtime-overrides',
        JSON.stringify({ overrides: [{}, {}], hostOverride: {} }),
      );

      await driver.when.started();

      expect(driver.get.publishedOverrideCounts()).toStrictEqual([3]);
    });

    it('should count the local overrides when only local storage holds a document', async () => {
      driver.given.localStorageItem(
        'atlas.runtime-overrides',
        JSON.stringify({ overrides: [{}, {}] }),
      );

      await driver.when.started();

      expect(driver.get.publishedOverrideCounts()).toStrictEqual([2]);
    });
  });

  describe('when the page is an atlas host', () => {
    const hostId = faker.string.uuid();

    beforeEach(() => {
      driver.given
        .pageBody(ATLAS_PAGE_BODY)
        .given.fetchJson({ schemaVersion: 'v1', hostId });
    });

    it('should poll every two seconds when started', async () => {
      await driver.when.started();

      expect(driver.get.setInterval()).toHaveBeenCalledWith(
        expect.any(Function),
        2000,
      );
    });

    describe('when the page is remote', () => {
      beforeEach(() => {
        driver.given.pageLocation(faker.internet.url());
      });

      it('should fetch only the runtime config when started', async () => {
        await driver.when.started();

        expect(
          driver.get.fetch().mock.calls.map(([input]) => String(input)),
        ).toStrictEqual(['/atlas.runtime.json']);
      });

      it('should publish zero overrides when nothing is stored', async () => {
        await driver.when.started();

        expect(driver.get.publishedOverrideCounts()).toStrictEqual([0]);
      });

      it('should count the persisted overrides when the extension stores a document for the host', async () => {
        driver.given.extensionStorageItem(`atlas.overrides.${hostId}`, {
          overrides: [{}, {}],
        });

        await driver.when.started();

        expect(driver.get.publishedOverrideCounts()).toStrictEqual([2]);
      });
    });

    describe('when the page is local', () => {
      beforeEach(() => {
        driver.given.pageLocation(`http://localhost:${faker.internet.port()}/`);
      });

      it('should fetch the development session from the default control port when none is remembered', async () => {
        await driver.when.started();

        expect(
          driver.get.fetch().mock.calls.map(([input]) => String(input)),
        ).toStrictEqual([
          '/atlas.runtime.json',
          `http://localhost:4400/atlas.dev-session.json?hostId=${hostId}`,
        ]);
      });

      it('should fetch the development session from the remembered control port when one is stored', async () => {
        const controlPort = faker.internet.port();

        driver.given.sessionStorageItem(
          'atlas.development-control-port',
          String(controlPort),
        );

        await driver.when.started();

        expect(
          driver.get.fetch().mock.calls.map(([input]) => String(input)),
        ).toStrictEqual([
          '/atlas.runtime.json',
          `http://localhost:${controlPort}/atlas.dev-session.json?hostId=${hostId}`,
        ]);
      });

      it('should count the development session overrides when the session belongs to the host', async () => {
        driver.given.fetchJson({
          schemaVersion: '1',
          hostId,
          overrides: [
            { appId: faker.string.uuid() },
            { appId: faker.string.uuid() },
          ],
          hostOverride: {},
        });

        await driver.when.started();

        expect(driver.get.publishedOverrideCounts()).toStrictEqual([3]);
      });

      it('should skip the disabled local apps when counting the development session', async () => {
        const disabledAppId = faker.string.uuid();

        driver.given
          .fetchJson({
            schemaVersion: '1',
            hostId,
            overrides: [
              { appId: disabledAppId },
              { appId: faker.string.uuid() },
            ],
            hostOverride: {},
          })
          .given.localStorageItem(
            `atlas.disabled-local-apps.${hostId}`,
            JSON.stringify([disabledAppId]),
          );

        await driver.when.started();

        expect(driver.get.publishedOverrideCounts()).toStrictEqual([2]);
      });

      it('should fall back to the persisted overrides when the development session is missing', async () => {
        driver.given
          .fetchStatus(404)
          .given.extensionStorageItem(`atlas.overrides.${hostId}`, {
            overrides: [{}],
          });

        await driver.when.started();

        expect(driver.get.publishedOverrideCounts()).toStrictEqual([1]);
      });

      it('should fall back to the persisted overrides when the development session belongs to another host', async () => {
        driver.given
          .fetchJson({
            schemaVersion: '1',
            hostId: faker.string.uuid(),
            overrides: [{}, {}],
          })
          .given.extensionStorageItem(`atlas.overrides.${hostId}`, {
            overrides: [{}],
          });

        await driver.when.started();

        expect(driver.get.publishedOverrideCounts()).toStrictEqual([1]);
      });
    });

    it('should publish the new count when the poll finds a change', async () => {
      driver.given.pageLocation(faker.internet.url());

      await driver.when.overridesStoredAndIntervalElapsed({
        overrides: [{}, {}],
      });

      expect(driver.get.publishedOverrideCounts()).toStrictEqual([0, 2]);
    });
  });

  describe('when the page changes', () => {
    it.each(WINDOW_EVENTS)(
      'should publish the new count when the window fires %s',
      async (eventType) => {
        await driver.when.overridesStoredAndEventFired(
          { overrides: [{}, {}] },
          eventType,
        );

        expect(driver.get.publishedOverrideCounts()).toStrictEqual([0, 2]);
      },
    );

    it('should not republish when the count is unchanged', async () => {
      await driver.when.overridesStoredAndEventFired(
        { overrides: [] },
        'focus',
      );

      expect(driver.get.publishedOverrideCounts()).toStrictEqual([0]);
    });

    it('should publish the new theme when the color scheme changes', async () => {
      driver.given.darkColorScheme(false);

      await driver.when.colorSchemeChanged(true);

      expect(driver.get.publishedColorSchemes()).toStrictEqual([
        'light',
        'dark',
      ]);
    });
  });

  describe('when an inspect host request arrives', () => {
    const documentKey = faker.word.noun();

    it('should inspect the host with the given document key when received', async () => {
      driver.given.hostData(aHostData());

      await driver.when.messageReceived(inspectHostRequest(documentKey));

      expect(driver.get.inspectAtlasHost()).toHaveBeenCalledWith(
        documentKey,
        expect.objectContaining({ loadVersion: driver.get.loadVersion() }),
      );
    });

    it('should respond with the host data when inspection succeeds', async () => {
      const hostData = aHostData();

      driver.given.hostData(hostData);

      await driver.when.messageReceived(inspectHostRequest(documentKey));

      expect(driver.get.response()).toStrictEqual({ ok: true, hostData });
    });

    it('should respond with the failure message when inspection fails', async () => {
      const reason = faker.lorem.sentence();

      driver.given.hostInspectionFailure(new Error(reason));

      await driver.when.messageReceived(inspectHostRequest(documentKey));

      expect(driver.get.response()).toStrictEqual({ ok: false, error: reason });
    });
  });

  describe('when a load artifact version request arrives', () => {
    const request = loadArtifactVersionRequest({
      artifactKey: faker.string.uuid(),
      versionKey: faker.string.uuid(),
    });

    it('should load the requested version from the registry when received', async () => {
      driver.given.loadedVersion(anAppManifest());

      await driver.when.messageReceived(request);

      expect(driver.get.loadVersion()).toHaveBeenCalledWith(
        request.artifactKey,
        request.versionKey,
      );
    });

    it('should respond with the manifest when the version loads', async () => {
      const manifest = anAppManifest();

      driver.given.loadedVersion(manifest);

      await driver.when.messageReceived(request);

      expect(driver.get.response()).toStrictEqual({ ok: true, manifest });
    });

    it('should respond with the failure message when the version cannot load', async () => {
      const reason = faker.lorem.sentence();

      driver.given.versionLoadFailure(new Error(reason));

      await driver.when.messageReceived(request);

      expect(driver.get.response()).toStrictEqual({ ok: false, error: reason });
    });
  });

  it('should respond with nothing when an unknown message arrives', async () => {
    await driver.when.messageReceived({ type: faker.word.noun() });

    expect(driver.get.response()).toBeUndefined();
  });
});
