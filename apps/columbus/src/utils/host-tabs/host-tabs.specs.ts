/** @jest-environment node */

import { faker } from '@faker-js/faker';
import { anAppManifest } from '@atlas/testkit';
import { aHostData } from '../../testkit/host-data.testkit';
import {
  findAtlasHostTab,
  loadArtifactVersionFromHostTab,
  reloadHostTab,
} from './host-tabs';
import { HostTabsDriver } from './host-tabs.driver';

const NO_HOST_TAB = 'Open an Atlas host in the active tab first.';

describe('findAtlasHostTab', () => {
  let driver: HostTabsDriver;

  beforeEach(() => {
    driver = new HostTabsDriver();
  });

  it('should reject when no tab is active', async () => {
    driver.given.tabs([{ id: faker.number.int(), url: faker.internet.url() }]);

    await expect(findAtlasHostTab()).rejects.toThrow(NO_HOST_TAB);
  });

  it('should reject when the active tab is not a web page', async () => {
    driver.given.tabs([
      { id: faker.number.int(), active: true, url: 'chrome://extensions' },
    ]);

    await expect(findAtlasHostTab()).rejects.toThrow(NO_HOST_TAB);
  });

  it('should return the active tab and its host data when the active tab hosts Atlas', async () => {
    const tab = {
      id: faker.number.int(),
      active: true,
      url: faker.internet.url(),
    };
    const hostData = aHostData();

    driver.given.tabs([tab]).given.tabMessageResponse({ ok: true, hostData });

    await expect(findAtlasHostTab()).resolves.toStrictEqual({ tab, hostData });
  });

  it('should inspect only the active tab when it is a remote page that does not host Atlas', async () => {
    const tab = {
      id: faker.number.int(),
      active: true,
      url: faker.internet.url(),
    };

    driver.given
      .tabs([tab, { id: faker.number.int(), url: faker.internet.url() }])
      .given.tabMessageResponse({ ok: false, error: faker.lorem.sentence() });

    await findAtlasHostTab().catch(() => undefined);

    expect(driver.get.tabMessage()).toHaveBeenCalledTimes(1);
  });

  it('should reject with the page error when the active tab is a remote page that does not host Atlas', async () => {
    const error = faker.lorem.sentence();

    driver.given
      .tabs([
        { id: faker.number.int(), active: true, url: faker.internet.url() },
      ])
      .given.tabMessageResponse({ ok: false, error });

    await expect(findAtlasHostTab()).rejects.toThrow(error);
  });

  describe('when an extension page is the active tab', () => {
    const popup = {
      id: faker.number.int(),
      active: true,
      lastAccessed: 30,
      url: `chrome-extension://${faker.string.alphanumeric(32)}/index.html`,
    };

    it('should return the most recent web tab when it hosts Atlas', async () => {
      const recent = {
        id: faker.number.int(),
        lastAccessed: 20,
        url: faker.internet.url(),
      };
      const hostData = aHostData();

      driver.given
        .tabs([
          popup,
          {
            id: faker.number.int(),
            lastAccessed: 10,
            url: faker.internet.url(),
          },
          recent,
        ])
        .given.tabMessageResponse({ ok: true, hostData });

      await expect(findAtlasHostTab()).resolves.toStrictEqual({
        tab: recent,
        hostData,
      });
    });

    it('should return the older web tab when the most recent one does not host Atlas', async () => {
      const older = {
        id: faker.number.int(),
        lastAccessed: 10,
        url: faker.internet.url(),
      };
      const hostData = aHostData();

      driver.given
        .tabs([
          popup,
          {
            id: faker.number.int(),
            lastAccessed: 20,
            url: faker.internet.url(),
          },
          older,
        ])
        .given.tabMessageResponse({ ok: false, error: faker.lorem.sentence() })
        .given.tabMessageResponse({ ok: true, hostData });

      await expect(findAtlasHostTab()).resolves.toStrictEqual({
        tab: older,
        hostData,
      });
    });

    it('should reject when no web tab hosts Atlas', async () => {
      driver.given
        .tabs([popup, { id: faker.number.int(), url: faker.internet.url() }])
        .given.tabMessageResponse({ ok: false, error: faker.lorem.sentence() });

      await expect(findAtlasHostTab()).rejects.toThrow(NO_HOST_TAB);
    });
  });

  describe('when the active tab is a local page that does not host Atlas', () => {
    const activeTab = {
      id: faker.number.int(),
      active: true,
      url: `http://localhost:${faker.internet.port()}/`,
    };
    const activeTabError = faker.lorem.sentence();

    beforeEach(() => {
      driver.given.tabMessageResponse({ ok: false, error: activeTabError });
    });

    it('should return the local preview when exactly one is open', async () => {
      const preview = {
        id: faker.number.int(),
        url: `http://localhost:${faker.internet.port()}/`,
      };
      const hostData = aHostData();

      driver.given
        .tabs([activeTab, preview])
        .given.tabMessageResponse({ ok: true, hostData });

      await expect(findAtlasHostTab()).resolves.toStrictEqual({
        tab: preview,
        hostData,
      });
    });

    it('should reject when several local previews are open', async () => {
      driver.given
        .tabs([
          activeTab,
          {
            id: faker.number.int(),
            url: `http://localhost:${faker.internet.port()}/`,
          },
          {
            id: faker.number.int(),
            url: `http://localhost:${faker.internet.port()}/`,
          },
        ])
        .given.tabMessageResponse({ ok: true, hostData: aHostData() })
        .given.tabMessageResponse({ ok: true, hostData: aHostData() });

      await expect(findAtlasHostTab()).rejects.toThrow(
        'Multiple local Atlas previews are open. Activate the intended App Preview tab, then open Columbus again.',
      );
    });

    it('should reject with the active tab error when no local preview hosts Atlas', async () => {
      driver.given
        .tabs([
          activeTab,
          {
            id: faker.number.int(),
            url: `http://localhost:${faker.internet.port()}/`,
          },
        ])
        .given.tabMessageResponse({ ok: false, error: faker.lorem.sentence() });

      await expect(findAtlasHostTab()).rejects.toThrow(
        `Columbus could not inspect the active host page: ${activeTabError} Suggested action: Open the Atlas App Preview URL printed by atlas dev, activate that browser tab, then reopen Columbus.`,
      );
    });
  });
});

describe('loadArtifactVersionFromHostTab', () => {
  let driver: HostTabsDriver;

  beforeEach(() => {
    driver = new HostTabsDriver();
  });

  it('should send a load artifact version request to the tab when the manifest channel is production', async () => {
    const tabId = faker.number.int();
    const manifest = anAppManifest({ channel: 'production' });

    driver.given.tabMessageResponse({ ok: true, manifest });

    await loadArtifactVersionFromHostTab({ tabId, manifest });

    expect(driver.get.tabMessage()).toHaveBeenCalledWith(tabId, {
      type: 'atlas.load-artifact-version',
      artifactKey: manifest.id,
      versionKey: `production:${manifest.version}:${manifest.buildId}`,
    });
  });

  it('should return the manifest the page responds with when the page succeeds', async () => {
    const manifest = anAppManifest();

    driver.given.tabMessageResponse({ ok: true, manifest });

    await expect(
      loadArtifactVersionFromHostTab({
        tabId: faker.number.int(),
        manifest: anAppManifest(),
      }),
    ).resolves.toBe(manifest);
  });

  it('should reject with the page error when the page reports one', async () => {
    const error = faker.lorem.sentence();

    driver.given.tabMessageResponse({ ok: false, error });

    await expect(
      loadArtifactVersionFromHostTab({
        tabId: faker.number.int(),
        manifest: anAppManifest(),
      }),
    ).rejects.toThrow(error);
  });

  it('should reject when the page returns an unexpected shape', async () => {
    driver.given.tabMessageResponse(null);

    await expect(
      loadArtifactVersionFromHostTab({
        tabId: faker.number.int(),
        manifest: anAppManifest(),
      }),
    ).rejects.toThrow(
      'Active page did not return the selected artifact version.',
    );
  });
});

describe('reloadHostTab', () => {
  let driver: HostTabsDriver;

  beforeEach(() => {
    driver = new HostTabsDriver();
  });

  it('should reload the given tab when called', async () => {
    const tabId = faker.number.int();

    await reloadHostTab(tabId);

    expect(driver.get.reloadedTabIds()).toStrictEqual([tabId]);
  });
});
