import { faker } from '@faker-js/faker';
import { PreviewTabsDriver } from './preview-tabs.driver';
import { focusPreviewTab, launchedPreviewUrl } from './preview-tabs';

describe('launchedPreviewUrl', () => {
  it('should return the preview url when the url is a loopback launcher', () => {
    const previewUrl = faker.internet.url();

    expect(
      launchedPreviewUrl(
        `http://localhost:${faker.internet.port()}/atlas.open?previewUrl=${encodeURIComponent(previewUrl)}`,
      ),
    ).toBe(previewUrl);
  });

  it('should return undefined when the launcher is not on a loopback host', () => {
    expect(
      launchedPreviewUrl(
        `https://${faker.internet.domainName()}/atlas.open?previewUrl=${encodeURIComponent(faker.internet.url())}`,
      ),
    ).toBeUndefined();
  });

  it('should return undefined when the loopback url is not the launcher path', () => {
    expect(
      launchedPreviewUrl(
        `http://localhost/${faker.lorem.word()}?previewUrl=${encodeURIComponent(faker.internet.url())}`,
      ),
    ).toBeUndefined();
  });

  it('should return undefined when the preview url is not a web page', () => {
    expect(
      launchedPreviewUrl(
        `http://localhost/atlas.open?previewUrl=${encodeURIComponent(`javascript:${faker.lorem.word()}`)}`,
      ),
    ).toBeUndefined();
  });
});

describe('focusPreviewTab', () => {
  let driver: PreviewTabsDriver;

  beforeEach(() => {
    driver = new PreviewTabsDriver();
  });

  describe('when a tab already shows a page of the launched preview', () => {
    const previewOrigin = `https://${faker.internet.domainName()}`;
    const launcherTab = {
      id: faker.number.int({ min: 1, max: 100 }),
      url: `http://localhost/atlas.open?previewUrl=${encodeURIComponent(`${previewOrigin}/`)}`,
    };
    const previewTab = {
      id: faker.number.int({ min: 101, max: 200 }),
      url: `${previewOrigin}/${faker.lorem.word()}`,
      windowId: faker.number.int(),
    };

    beforeEach(() => {
      driver.given.openTabs([launcherTab, previewTab]);
    });

    it('should return true when focused', async () => {
      await expect(focusPreviewTab({ launcherTab })).resolves.toBe(true);
    });

    it('should activate the preview tab when focused', async () => {
      await focusPreviewTab({ launcherTab });

      expect(driver.get.activatedTabIds()).toStrictEqual([previewTab.id]);
    });

    it('should focus the window of the preview tab when focused', async () => {
      await focusPreviewTab({ launcherTab });

      expect(driver.get.focusedWindowIds()).toStrictEqual([
        previewTab.windowId,
      ]);
    });

    it('should reload the preview tab when focused', async () => {
      await focusPreviewTab({ launcherTab });

      expect(driver.get.reloadedTabIds()).toStrictEqual([previewTab.id]);
    });

    it('should close the launcher tab when focused', async () => {
      await focusPreviewTab({ launcherTab });

      expect(driver.get.removedTabIds()).toStrictEqual([launcherTab.id]);
    });
  });

  it('should activate the most recently used preview tab when several show the preview', async () => {
    const previewUrl = faker.internet.url();
    const launcherTab = {
      id: faker.number.int({ min: 1, max: 100 }),
      url: `http://localhost/atlas.open?previewUrl=${encodeURIComponent(previewUrl)}`,
    };
    const recent = {
      id: faker.number.int({ min: 101, max: 200 }),
      url: previewUrl,
      lastAccessed: faker.number.int({ min: 1_001, max: 2_000 }),
    };
    driver.given.openTabs([
      launcherTab,
      {
        id: faker.number.int({ min: 201, max: 300 }),
        url: previewUrl,
        lastAccessed: faker.number.int({ min: 1, max: 1_000 }),
      },
      recent,
    ]);

    await focusPreviewTab({ launcherTab });

    expect(driver.get.activatedTabIds()).toStrictEqual([recent.id]);
  });

  it('should return false when no tab shows the launched preview', async () => {
    const launcherTab = {
      id: faker.number.int({ min: 1, max: 100 }),
      url: `http://localhost/atlas.open?previewUrl=${encodeURIComponent(`https://${faker.internet.domainName()}/`)}`,
    };
    driver.given.openTabs([
      launcherTab,
      {
        id: faker.number.int({ min: 101, max: 200 }),
        url: `https://${faker.internet.domainName()}/`,
      },
    ]);

    await expect(focusPreviewTab({ launcherTab })).resolves.toBe(false);
  });

  it('should return true when a tab shows another route of the preview origin', async () => {
    const previewOrigin = `https://${faker.internet.domainName()}`;
    const launcherTab = {
      id: faker.number.int({ min: 1, max: 100 }),
      url: `http://localhost/atlas.open?previewUrl=${encodeURIComponent(`${previewOrigin}/${faker.lorem.word()}-a`)}`,
    };
    driver.given.openTabs([
      launcherTab,
      {
        id: faker.number.int({ min: 101, max: 200 }),
        url: `${previewOrigin}/${faker.lorem.word()}-b`,
      },
    ]);

    await expect(focusPreviewTab({ launcherTab })).resolves.toBe(true);
  });

  it('should return false when a tab shows the preview route on another origin', async () => {
    const previewPath = `/${faker.lorem.word()}`;
    const launcherTab = {
      id: faker.number.int({ min: 1, max: 100 }),
      url: `http://localhost/atlas.open?previewUrl=${encodeURIComponent(`https://${faker.internet.domainName()}${previewPath}`)}`,
    };
    driver.given.openTabs([
      launcherTab,
      {
        id: faker.number.int({ min: 101, max: 200 }),
        url: `https://${faker.internet.domainName()}${previewPath}`,
      },
    ]);

    await expect(focusPreviewTab({ launcherTab })).resolves.toBe(false);
  });

  it('should return false when the sender is not a launcher tab', async () => {
    const previewUrl = faker.internet.url();
    const senderTab = {
      id: faker.number.int({ min: 1, max: 100 }),
      url: previewUrl,
    };
    driver.given.openTabs([
      senderTab,
      { id: faker.number.int({ min: 101, max: 200 }), url: previewUrl },
    ]);

    await expect(focusPreviewTab({ launcherTab: senderTab })).resolves.toBe(
      false,
    );
  });
});
