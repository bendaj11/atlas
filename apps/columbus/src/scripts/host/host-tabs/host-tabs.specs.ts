/** @jest-environment node */

import { faker } from '@faker-js/faker';
import { aHostData, anAppArtifactVersion } from '../../../types/app.testkit';
import { HostTabsDriver } from './host-tabs.driver';

const HOST_URL = 'http://127.0.0.1:4300/orders';
const POPUP_URL = 'chrome-extension://atlas/index.html';

describe('findAtlasHostTab', () => {
  let driver: HostTabsDriver;

  beforeEach(() => {
    driver = new HostTabsDriver();
  });

  it('should select the active tab when it hosts Atlas', async () => {
    await driver.given
      .tabs([{ id: 7, active: true, url: HOST_URL }])
      .given.atlasHost(7)
      .when.hostTabSearched();

    expect(driver.get.foundTabId()).toBe(7);
  });

  it('should fail when no tab is active', async () => {
    await driver.given.tabs([{ id: 7, url: HOST_URL }]).when.hostTabSearched();

    expect(driver.get.errorMessage()).toBe(
      'Open an Atlas host in the active tab first.',
    );
  });

  it('should fail when the active tab is not a web page', async () => {
    await driver.given
      .tabs([{ id: 7, active: true, url: 'chrome://extensions' }])
      .when.hostTabSearched();

    expect(driver.get.errorMessage()).toBe(
      'Open an Atlas host in the active tab first.',
    );
  });

  describe('when the popup itself is the active tab', () => {
    it('should select the most recent web tab when it hosts Atlas', async () => {
      await driver.given
        .tabs([
          { id: 9, active: true, lastAccessed: 30, url: POPUP_URL },
          { id: 8, lastAccessed: 10, url: 'https://other.example/' },
          { id: 7, lastAccessed: 20, url: HOST_URL },
        ])
        .given.atlasHost(7)
        .given.atlasHost(8)
        .when.hostTabSearched();

      expect(driver.get.foundTabId()).toBe(7);
    });

    it('should skip tabs when they do not host Atlas', async () => {
      await driver.given
        .tabs([
          { id: 9, active: true, lastAccessed: 30, url: POPUP_URL },
          { id: 8, lastAccessed: 20, url: 'https://other.example/' },
          { id: 7, lastAccessed: 10, url: HOST_URL },
        ])
        .given.atlasHost(7)
        .when.hostTabSearched();

      expect(driver.get.foundTabId()).toBe(7);
    });

    it('should fail when no web tab hosts Atlas', async () => {
      await driver.given
        .tabs([
          { id: 9, active: true, url: POPUP_URL },
          { id: 8, url: 'https://other.example/' },
        ])
        .when.hostTabSearched();

      expect(driver.get.errorMessage()).toBe(
        'Open an Atlas host in the active tab first.',
      );
    });
  });

  describe('when the active tab is a local page without Atlas', () => {
    it('should select the local preview when exactly one is open', async () => {
      await driver.given
        .tabs([
          { id: 8, active: true, url: 'http://localhost:4201/' },
          { id: 7, url: 'http://localhost:4300/orders' },
        ])
        .given.atlasHost(7)
        .when.hostTabSearched();

      expect(driver.get.foundTabId()).toBe(7);
    });

    it('should report ambiguity when several local previews are open', async () => {
      await driver.given
        .tabs([
          { id: 9, active: true, url: 'http://localhost:4201/' },
          { id: 8, url: 'http://localhost:4301/orders' },
          { id: 7, url: 'http://localhost:4300/orders' },
        ])
        .given.atlasHost(8, aHostData())
        .given.atlasHost(7, aHostData())
        .when.hostTabSearched();

      expect(driver.get.errorMessage()).toContain(
        'Multiple local Atlas previews',
      );
    });

    it('should explain the failure when no local preview hosts Atlas', async () => {
      await driver.given
        .tabs([
          { id: 9, active: true, url: 'http://localhost:4201/' },
          { id: 8, url: 'http://localhost:4301/orders' },
        ])
        .when.hostTabSearched();

      expect(driver.get.errorMessage()).toContain(
        'Columbus could not inspect the active host page: No Atlas runtime on this page.',
      );
    });
  });

  it('should not scan other tabs when the active page is remote and lacks Atlas', async () => {
    await driver.given
      .tabs([
        { id: 8, active: true, url: 'https://example.com/' },
        { id: 7, url: HOST_URL },
      ])
      .given.atlasHost(7)
      .when.hostTabSearched();

    expect(driver.get.inspectedTabIds()).toEqual([8]);
  });
});

describe('loadArtifactVersionFromHostTab', () => {
  let driver: HostTabsDriver;

  beforeEach(() => {
    driver = new HostTabsDriver();
  });

  it('should send a load artifact version request with the manifest version key when the manifest is a production version', async () => {
    const artifactKey = faker.string.uuid();
    const manifest = anAppArtifactVersion({ channel: 'production' });
    await driver.when.manifestLoaded({
      tabId: faker.number.int(),
      artifactKey,
      manifest,
    });

    expect(driver.get.lastTabMessage()).toEqual({
      type: 'atlas.load-artifact-version',
      artifactKey,
      versionKey: `production:${manifest.version}:${manifest.buildId}`,
    });
  });

  it('should fail with the page error when the page reports one', async () => {
    await driver.given
      .artifactVersionResponse({ ok: false, error: 'Version missing.' })
      .when.manifestLoaded({
        tabId: faker.number.int(),
        artifactKey: faker.string.uuid(),
        manifest: anAppArtifactVersion(),
      });

    expect(driver.get.errorMessage()).toBe('Version missing.');
  });

  it('should fail when the page returns an unexpected shape', async () => {
    await driver.given.artifactVersionResponse(undefined).when.manifestLoaded({
      tabId: faker.number.int(),
      artifactKey: faker.string.uuid(),
      manifest: anAppArtifactVersion(),
    });

    expect(driver.get.errorMessage()).toBe(
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
    await driver.when.tabReloaded(7);

    expect(driver.get.reloadedTabIds()).toEqual([7]);
  });
});
