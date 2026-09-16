import { aHostData } from '../../types/host-data.testkit';
import { anAppArtifactVersion } from '../../types/artifact-version.testkit';
import {
  inspectHostRequest,
  loadArtifactVersionRequest,
} from '../shared/messages/messages';
import { BadgeScriptDriver } from './badge-script.driver';

const ATLAS_PAGE_BODY =
  '<div id="atlas-host-root"></div><script src="/atlas.loader.js"></script>';
const RUNTIME_CONFIG = { schemaVersion: 'v1', hostId: 'shop' };
const DEV_SESSION_URL =
  'http://localhost:4400/atlas.dev-session.json?hostId=shop';
const TWO_OVERRIDES = JSON.stringify({ overrides: [{}, {}] });
const THREE_OVERRIDES = JSON.stringify({
  overrides: [{}, {}],
  hostOverride: {},
});
const DEV_SESSION = {
  schemaVersion: '1',
  hostId: 'shop',
  overrides: [{ appId: 'orders' }, { appId: 'cart' }],
  hostOverride: {},
};
const WINDOW_EVENTS = ['focus', 'pageshow', 'storage'];

describe('badge-script', () => {
  let driver: BadgeScriptDriver;

  beforeEach(() => {
    driver = new BadgeScriptDriver();
  });

  describe('when started', () => {
    it('should publish the dark theme when the page prefers a dark color scheme', async () => {
      await driver.given.darkColorScheme(true).when.started();

      expect(driver.get.publishedColorSchemes()).toEqual(['dark']);
    });

    it('should publish the light theme when the page prefers a light color scheme', async () => {
      await driver.given.darkColorScheme(false).when.started();

      expect(driver.get.publishedColorSchemes()).toEqual(['light']);
    });

    it('should publish zero overrides when the page is not an atlas host', async () => {
      await driver.when.started();

      expect(driver.get.publishedOverrideCounts()).toEqual([0]);
    });

    it('should count the session overrides when the page stores a document', async () => {
      await driver.given
        .sessionStorageItem('atlas.runtime-overrides', THREE_OVERRIDES)
        .when.started();

      expect(driver.get.publishedOverrideCounts()).toEqual([3]);
    });

    it('should count the local overrides when only local storage has a document', async () => {
      await driver.given
        .localStorageItem('atlas.runtime-overrides', TWO_OVERRIDES)
        .when.started();

      expect(driver.get.publishedOverrideCounts()).toEqual([2]);
    });

    it('should not poll when the page is not an atlas host', async () => {
      await driver.when.started();

      expect(driver.get.refreshIntervalsMs()).toEqual([]);
    });
  });

  describe('when the page is an atlas host', () => {
    beforeEach(() => {
      driver.given
        .pageBody(ATLAS_PAGE_BODY)
        .given.response('/atlas.runtime.json', RUNTIME_CONFIG);
    });

    it('should poll every two seconds when started', async () => {
      await driver.when.started();

      expect(driver.get.refreshIntervalsMs()).toEqual([2000]);
    });

    it('should publish zero overrides when nothing is stored', async () => {
      await driver.given.pageLocation('https://shop.example/').when.started();

      expect(driver.get.publishedOverrideCounts()).toEqual([0]);
    });

    it('should count the persisted overrides when the extension stores a document', async () => {
      await driver.given
        .pageLocation('https://shop.example/')
        .given.extensionStorageItem('atlas.overrides.shop', {
          overrides: [{}, {}],
        })
        .when.started();

      expect(driver.get.publishedOverrideCounts()).toEqual([2]);
    });

    it('should not fetch the development session when the page is not local', async () => {
      await driver.given.pageLocation('https://shop.example/').when.started();

      expect(driver.get.fetchedUrls()).toEqual(['/atlas.runtime.json']);
    });

    it('should fetch the development session from the remembered control port when one is stored', async () => {
      await driver.given
        .sessionStorageItem('atlas.development-control-port', '4512')
        .when.started();

      expect(driver.get.fetchedUrls()).toEqual([
        '/atlas.runtime.json',
        'http://localhost:4512/atlas.dev-session.json?hostId=shop',
      ]);
    });

    it('should fetch the development session from the default control port when none is stored', async () => {
      await driver.when.started();

      expect(driver.get.fetchedUrls()).toEqual([
        '/atlas.runtime.json',
        DEV_SESSION_URL,
      ]);
    });

    it('should count the development session overrides when the page is local', async () => {
      await driver.given.response(DEV_SESSION_URL, DEV_SESSION).when.started();

      expect(driver.get.publishedOverrideCounts()).toEqual([3]);
    });

    it('should skip disabled local apps when counting the development session', async () => {
      await driver.given
        .response(DEV_SESSION_URL, DEV_SESSION)
        .given.localStorageItem(
          'atlas.disabled-local-apps.shop',
          JSON.stringify(['orders']),
        )
        .when.started();

      expect(driver.get.publishedOverrideCounts()).toEqual([2]);
    });

    it('should fall back to persisted overrides when the development session is missing', async () => {
      await driver.given
        .extensionStorageItem('atlas.overrides.shop', { overrides: [{}] })
        .when.started();

      expect(driver.get.publishedOverrideCounts()).toEqual([1]);
    });

    it('should fall back to persisted overrides when the development session belongs to another host', async () => {
      await driver.given
        .response(DEV_SESSION_URL, { ...DEV_SESSION, hostId: 'other' })
        .given.extensionStorageItem('atlas.overrides.shop', { overrides: [{}] })
        .when.started();

      expect(driver.get.publishedOverrideCounts()).toEqual([1]);
    });

    it('should publish the new count when the poll finds a change', async () => {
      await driver.when.overridesStoredAndIntervalElapsed({
        overrides: [{}, {}],
      });

      expect(driver.get.publishedOverrideCounts()).toEqual([0, 2]);
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

        expect(driver.get.publishedOverrideCounts()).toEqual([0, 2]);
      },
    );

    it('should not republish when the count is unchanged', async () => {
      await driver.when.overridesStoredAndEventFired(
        { overrides: [] },
        'focus',
      );

      expect(driver.get.publishedOverrideCounts()).toEqual([0]);
    });

    it('should publish the new theme when the color scheme changes', async () => {
      await driver.when.colorSchemeChanged(true);

      expect(driver.get.publishedColorSchemes()).toEqual(['light', 'dark']);
    });
  });

  describe('when an inspect host request arrives', () => {
    it('should inspect the given document key when requested', async () => {
      await driver.when.messageReceived(inspectHostRequest('atlas.overrides'));

      expect(driver.get.inspectedDocumentKeys()).toEqual(['atlas.overrides']);
    });

    it('should respond with the host data when inspection succeeds', async () => {
      const hostData = aHostData();
      await driver.given
        .hostData(hostData)
        .when.messageReceived(inspectHostRequest('atlas.overrides'));

      expect(driver.get.response()).toEqual({ ok: true, hostData });
    });

    it('should respond with the failure when inspection fails', async () => {
      await driver.given
        .hostInspectionFailure('Atlas runtime configuration is missing.')
        .when.messageReceived(inspectHostRequest('atlas.overrides'));

      expect(driver.get.response()).toEqual({
        ok: false,
        error: 'Atlas runtime configuration is missing.',
      });
    });
  });

  describe('when a load version request arrives', () => {
    it('should load the given version when requested', async () => {
      await driver.when.messageReceived(
        loadArtifactVersionRequest({
          artifactKey: 'app:orders',
          versionKey: '1.2.0',
        }),
      );

      expect(driver.get.loadedVersionKeys()).toEqual([['app:orders', '1.2.0']]);
    });

    it('should respond with the manifest when the version loads', async () => {
      const manifest = anAppArtifactVersion();
      await driver.given.loadedVersion(manifest).when.messageReceived(
        loadArtifactVersionRequest({
          artifactKey: 'app:orders',
          versionKey: '1.2.0',
        }),
      );

      expect(driver.get.response()).toEqual({ ok: true, manifest });
    });

    it('should respond with the failure when the version cannot load', async () => {
      await driver.given
        .versionLoadFailure('Version 1.2.0 is not published.')
        .when.messageReceived(
          loadArtifactVersionRequest({
            artifactKey: 'app:orders',
            versionKey: '1.2.0',
          }),
        );

      expect(driver.get.response()).toEqual({
        ok: false,
        error: 'Version 1.2.0 is not published.',
      });
    });
  });

  it('should respond with nothing when an unknown message arrives', async () => {
    await driver.when.messageReceived({ type: 'other' });

    expect(driver.get.response()).toBeUndefined();
  });
});
