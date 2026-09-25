import { faker } from '@faker-js/faker';
import { aHostManifest, anAppManifest } from '@atlas/testkit';
import { anOverrideDocument } from '@atlas/testkit/internal';
import { aHostData } from '../../../testkit/host-data.testkit';
import {
  inspectHostRequest,
  loadArtifactVersionRequest,
  readPageStateRequest,
} from '../../../utils/messages/messages';
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

    it('should count the session overrides when session storage holds an override document', async () => {
      const first = anAppManifest();
      const second = anAppManifest();

      driver.given.sessionStorageItem(
        'atlas.runtime-overrides',
        JSON.stringify({
          ...anOverrideDocument({
            overrides: [
              { appId: first.id, manifest: first, reason: 'local' },
              { appId: second.id, manifest: second, reason: 'local' },
            ],
          }),
          hostOverride: aHostManifest(),
        }),
      );

      await driver.when.started();

      expect(driver.get.publishedOverrideCounts()).toStrictEqual([3]);
    });

    it('should count the local overrides when only local storage holds an override document', async () => {
      const first = anAppManifest();
      const second = anAppManifest();

      driver.given.localStorageItem(
        'atlas.runtime-overrides',
        JSON.stringify(
          anOverrideDocument({
            overrides: [
              { appId: first.id, manifest: first, reason: 'local' },
              { appId: second.id, manifest: second, reason: 'local' },
            ],
          }),
        ),
      );

      await driver.when.started();

      expect(driver.get.publishedOverrideCounts()).toStrictEqual([2]);
    });

    it('should publish zero overrides when session storage holds an invalid document', async () => {
      driver.given.sessionStorageItem(
        'atlas.runtime-overrides',
        JSON.stringify({ overrides: [{}, {}] }),
      );

      await driver.when.started();

      expect(driver.get.publishedOverrideCounts()).toStrictEqual([0]);
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

    it('should fetch only the runtime config when started', async () => {
      await driver.when.started();

      expect(
        driver.get.fetch().mock.calls.map(([input]) => String(input)),
      ).toStrictEqual(['/atlas.runtime.json']);
    });

    it('should publish zero overrides when nothing is stored and no development session is offered', async () => {
      await driver.when.started();

      expect(driver.get.publishedOverrideCounts()).toStrictEqual([0]);
    });

    it('should request the development session for the host and page when started', async () => {
      const href = faker.internet.url();

      driver.given.pageLocation(href);

      await driver.when.started();

      expect(driver.get.runtimeMessage()).toHaveBeenCalledWith({
        type: 'atlas.load-development-session',
        hostId,
        previewUrl: href,
      });
    });

    it('should request the development session through the remembered control port when one is stored', async () => {
      const href = faker.internet.url();
      const controlPort = faker.internet.port();

      driver.given
        .pageLocation(href)
        .given.sessionStorageItem(
          'atlas.development-control-port',
          String(controlPort),
        );

      await driver.when.started();

      expect(driver.get.runtimeMessage()).toHaveBeenCalledWith({
        type: 'atlas.load-development-session',
        hostId,
        previewUrl: href,
        controlPort,
      });
    });

    it('should count the persisted overrides when the extension stores an override document for the host', async () => {
      const first = anAppManifest();
      const second = anAppManifest();

      driver.given.extensionStorageItem(
        `atlas.overrides.${hostId}`,
        anOverrideDocument({
          overrides: [
            { appId: first.id, manifest: first, reason: 'local' },
            { appId: second.id, manifest: second, reason: 'local' },
          ],
        }),
      );

      await driver.when.started();

      expect(driver.get.publishedOverrideCounts()).toStrictEqual([2]);
    });

    it('should count the offered overrides when the development session of the host offers apps and a host that are not dismissed', async () => {
      const manifest = anAppManifest();
      const hostOverride = aHostManifest();

      driver.given.developmentSession({
        ...anOverrideDocument({
          hostId,
          overrides: [{ appId: manifest.id, manifest, reason: 'local' }],
        }),
        hostOverride,
        offerIds: {
          [manifest.id]: faker.string.uuid(),
          [hostOverride.id]: faker.string.uuid(),
        },
      });

      await driver.when.started();

      expect(driver.get.publishedOverrideCounts()).toStrictEqual([2]);
    });

    it('should skip the offered override when its live offer is dismissed', async () => {
      const offerId = faker.string.uuid();
      const dismissed = anAppManifest();
      const offered = anAppManifest();

      driver.given
        .developmentSession({
          ...anOverrideDocument({
            hostId,
            overrides: [
              { appId: dismissed.id, manifest: dismissed, reason: 'local' },
              { appId: offered.id, manifest: offered, reason: 'local' },
            ],
          }),
          offerIds: {
            [dismissed.id]: offerId,
            [offered.id]: faker.string.uuid(),
          },
        })
        .given.localStorageItem(
          `atlas.dismissed-development-offers.${hostId}`,
          JSON.stringify({ [dismissed.id]: offerId }),
        );

      await driver.when.started();

      expect(driver.get.publishedOverrideCounts()).toStrictEqual([1]);
    });

    it('should count the offered override when only an earlier offer of the app is dismissed', async () => {
      const dismissed = anAppManifest();
      const offered = anAppManifest();

      driver.given
        .developmentSession({
          ...anOverrideDocument({
            hostId,
            overrides: [
              { appId: dismissed.id, manifest: dismissed, reason: 'local' },
              { appId: offered.id, manifest: offered, reason: 'local' },
            ],
          }),
          offerIds: {
            [dismissed.id]: faker.string.uuid(),
            [offered.id]: faker.string.uuid(),
          },
        })
        .given.localStorageItem(
          `atlas.dismissed-development-offers.${hostId}`,
          JSON.stringify({ [dismissed.id]: faker.string.uuid() }),
        );

      await driver.when.started();

      expect(driver.get.publishedOverrideCounts()).toStrictEqual([2]);
    });

    it('should count the stored selection plus the offered overrides when the offers are for other apps', async () => {
      const selected = anAppManifest();
      const offered = anAppManifest();

      driver.given
        .sessionStorageItem(
          'atlas.runtime-overrides',
          JSON.stringify(
            anOverrideDocument({
              overrides: [
                { appId: selected.id, manifest: selected, reason: 'local' },
              ],
            }),
          ),
        )
        .given.developmentSession({
          ...anOverrideDocument({
            hostId,
            overrides: [
              { appId: offered.id, manifest: offered, reason: 'local' },
            ],
          }),
          offerIds: { [offered.id]: faker.string.uuid() },
        });

      await driver.when.started();

      expect(driver.get.publishedOverrideCounts()).toStrictEqual([2]);
    });

    it('should count the stored selection once when the offer is for the selected app', async () => {
      const selected = anAppManifest();

      driver.given
        .sessionStorageItem(
          'atlas.runtime-overrides',
          JSON.stringify(
            anOverrideDocument({
              overrides: [
                { appId: selected.id, manifest: selected, reason: 'local' },
              ],
            }),
          ),
        )
        .given.developmentSession({
          ...anOverrideDocument({
            hostId,
            overrides: [
              { appId: selected.id, manifest: selected, reason: 'local' },
            ],
          }),
          offerIds: { [selected.id]: faker.string.uuid() },
        });

      await driver.when.started();

      expect(driver.get.publishedOverrideCounts()).toStrictEqual([1]);
    });

    it('should count only the persisted overrides when the development session belongs to another host', async () => {
      const persisted = anAppManifest();
      const offered = anAppManifest();

      driver.given
        .extensionStorageItem(
          `atlas.overrides.${hostId}`,
          anOverrideDocument({
            overrides: [
              { appId: persisted.id, manifest: persisted, reason: 'local' },
            ],
          }),
        )
        .given.developmentSession({
          ...anOverrideDocument({
            hostId: faker.string.uuid(),
            overrides: [
              { appId: offered.id, manifest: offered, reason: 'local' },
            ],
          }),
          offerIds: { [offered.id]: faker.string.uuid() },
        });

      await driver.when.started();

      expect(driver.get.publishedOverrideCounts()).toStrictEqual([1]);
    });

    it('should request the development session again on the next poll when the first read fails', async () => {
      driver.given.developmentSessionError(faker.lorem.sentence());

      await driver.when.started();
      await driver.when.intervalElapsed();

      expect(
        driver.get
          .runtimeMessage()
          .mock.calls.filter(
            ([message]) =>
              typeof message === 'object' &&
              message !== null &&
              'type' in message &&
              message.type === 'atlas.load-development-session',
          ),
      ).toHaveLength(2);
    });

    it('should not request the development session again on the next poll when the first read succeeds', async () => {
      const manifest = anAppManifest();

      driver.given.developmentSession({
        ...anOverrideDocument({
          hostId,
          overrides: [{ appId: manifest.id, manifest, reason: 'local' }],
        }),
        offerIds: { [manifest.id]: faker.string.uuid() },
      });

      await driver.when.started();
      await driver.when.intervalElapsed();

      expect(
        driver.get
          .runtimeMessage()
          .mock.calls.filter(
            ([message]) =>
              typeof message === 'object' &&
              message !== null &&
              'type' in message &&
              message.type === 'atlas.load-development-session',
          ),
      ).toHaveLength(1);
    });

    it('should publish the new count when the poll finds a change', async () => {
      const first = anAppManifest();
      const second = anAppManifest();

      await driver.when.overridesStoredAndIntervalElapsed(
        anOverrideDocument({
          overrides: [
            { appId: first.id, manifest: first, reason: 'local' },
            { appId: second.id, manifest: second, reason: 'local' },
          ],
        }),
      );

      expect(driver.get.publishedOverrideCounts()).toStrictEqual([0, 2]);
    });
  });

  describe('when the page changes', () => {
    it.each(WINDOW_EVENTS)(
      'should publish the new count when the window fires %s',
      async (eventType) => {
        const first = anAppManifest();
        const second = anAppManifest();

        await driver.when.overridesStoredAndEventFired(
          anOverrideDocument({
            overrides: [
              { appId: first.id, manifest: first, reason: 'local' },
              { appId: second.id, manifest: second, reason: 'local' },
            ],
          }),
          eventType,
        );

        expect(driver.get.publishedOverrideCounts()).toStrictEqual([0, 2]);
      },
    );

    it('should not republish when the count is unchanged', async () => {
      await driver.when.overridesStoredAndEventFired(
        anOverrideDocument({ overrides: [] }),
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

  it('should respond with the visible app ids and runtime errors of the page when a read page state request arrives', async () => {
    const visibleAppIds = [faker.string.uuid()];
    const runtimeErrors = [{ message: faker.lorem.sentence() }];

    driver.given
      .visibleAppIds(visibleAppIds)
      .given.runtimeErrors(runtimeErrors);

    await driver.when.messageReceived(readPageStateRequest());

    expect(driver.get.response()).toStrictEqual({
      ok: true,
      pageState: { visibleAppIds, runtimeErrors },
    });
  });

  it('should respond with nothing when an unknown message arrives', async () => {
    await driver.when.messageReceived({ type: faker.word.noun() });

    expect(driver.get.response()).toBeUndefined();
  });
});
