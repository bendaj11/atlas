import { faker } from '@faker-js/faker';
import { aHostManifest, anAppManifest } from '@atlas/testkit';
import { aHostData } from '../../testkit/host-data.testkit';
import {
  readDisabledArtifactVersionOverrides,
  readPersistedOverrideDocument,
  writeDisabledArtifactVersionOverrides,
  writeOverrideDocument,
} from './override-storage';
import { OverrideStorageDriver } from './override-storage.driver';

const DOCUMENT_KEY = 'atlas.runtime-overrides';

describe('readPersistedOverrideDocument', () => {
  let driver: OverrideStorageDriver;

  beforeEach(() => {
    driver = new OverrideStorageDriver();
  });

  it('should return nothing when no document is stored', async () => {
    await expect(
      readPersistedOverrideDocument(aHostData()),
    ).resolves.toBeUndefined();
  });

  it('should return the document when a valid one is stored for the host', async () => {
    const hostData = aHostData();
    const document = {
      schemaVersion: '1',
      hostId: hostData.config.hostId,
      overrides: [],
      generatedAt: faker.date.recent().toISOString(),
    };

    driver.given.extensionStorageItem(
      `atlas.overrides.${hostData.config.hostId}`,
      document,
    );

    await expect(readPersistedOverrideDocument(hostData)).resolves.toBe(
      document,
    );
  });

  it('should return nothing when the stored document belongs to another host', async () => {
    const hostData = aHostData();

    driver.given.extensionStorageItem(
      `atlas.overrides.${hostData.config.hostId}`,
      {
        schemaVersion: '1',
        hostId: faker.string.uuid(),
        overrides: [],
        generatedAt: faker.date.recent().toISOString(),
      },
    );

    await expect(
      readPersistedOverrideDocument(hostData),
    ).resolves.toBeUndefined();
  });
});

describe('writeOverrideDocument', () => {
  let driver: OverrideStorageDriver;

  beforeEach(() => {
    driver = new OverrideStorageDriver();
  });

  describe('when scope is tab', () => {
    const hostData = aHostData();
    const documentValue = {
      schemaVersion: '1' as const,
      hostId: hostData.config.hostId,
      overrides: [],
      generatedAt: faker.date.recent().toISOString(),
    };
    const dismissedOfferIds = { [faker.string.uuid()]: faker.string.uuid() };

    beforeEach(async () => {
      await writeOverrideDocument({
        tabId: faker.number.int(),
        hostData,
        documentValue,
        scope: 'tab',
        dismissedOfferIds,
      });
    });

    it('should store the document in page session storage when written', () => {
      expect(driver.get.pageSessionStorageItem(DOCUMENT_KEY)).toStrictEqual(
        documentValue,
      );
    });

    it('should store the dismissed offer ids in page session storage when written', () => {
      expect(
        driver.get.pageSessionStorageItem(
          `atlas.dismissed-development-offers.${hostData.config.hostId}`,
        ),
      ).toStrictEqual(dismissedOfferIds);
    });

    it('should not persist the document in extension storage when written', () => {
      expect(
        driver.get.extensionStorageItem(
          `atlas.overrides.${hostData.config.hostId}`,
        ),
      ).toBeUndefined();
    });
  });

  describe('when scope is all, the document has an app override, and no offer is dismissed', () => {
    const hostData = aHostData();
    const manifest = anAppManifest();
    const documentValue = {
      schemaVersion: '1' as const,
      hostId: hostData.config.hostId,
      overrides: [{ appId: manifest.id, manifest, reason: 'pr' as const }],
      generatedAt: faker.date.recent().toISOString(),
    };

    it('should remove the document from page session storage when written', async () => {
      driver.given.pageSessionStorageItem(
        DOCUMENT_KEY,
        JSON.stringify(documentValue),
      );

      await writeOverrideDocument({
        tabId: faker.number.int(),
        hostData,
        documentValue,
        scope: 'all',
        dismissedOfferIds: {},
      });

      expect(driver.get.pageSessionStorageItem(DOCUMENT_KEY)).toBeUndefined();
    });

    it('should remove the dismissed offer ids from page local storage when written', async () => {
      const dismissedOffersKey = `atlas.dismissed-development-offers.${hostData.config.hostId}`;

      driver.given.pageLocalStorageItem(
        dismissedOffersKey,
        JSON.stringify({ [faker.string.uuid()]: faker.string.uuid() }),
      );

      await writeOverrideDocument({
        tabId: faker.number.int(),
        hostData,
        documentValue,
        scope: 'all',
        dismissedOfferIds: {},
      });

      expect(
        driver.get.pageLocalStorageItem(dismissedOffersKey),
      ).toBeUndefined();
    });

    describe('when written', () => {
      beforeEach(async () => {
        await writeOverrideDocument({
          tabId: faker.number.int(),
          hostData,
          documentValue,
          scope: 'all',
          dismissedOfferIds: {},
        });
      });

      it('should store the document in page local storage when written', () => {
        expect(driver.get.pageLocalStorageItem(DOCUMENT_KEY)).toStrictEqual(
          documentValue,
        );
      });

      it('should persist the document in extension storage when written', () => {
        expect(
          driver.get.extensionStorageItem(
            `atlas.overrides.${hostData.config.hostId}`,
          ),
        ).toStrictEqual(documentValue);
      });
    });
  });

  it('should store the document in page local storage when scope is all and the document has only a host override', async () => {
    const hostData = aHostData();
    const documentValue = {
      schemaVersion: '1' as const,
      hostId: hostData.config.hostId,
      overrides: [],
      hostOverride: aHostManifest(),
      generatedAt: faker.date.recent().toISOString(),
    };

    await writeOverrideDocument({
      tabId: faker.number.int(),
      hostData,
      documentValue,
      scope: 'all',
      dismissedOfferIds: {},
    });

    expect(driver.get.pageLocalStorageItem(DOCUMENT_KEY)).toStrictEqual(
      documentValue,
    );
  });

  describe('when scope is all, the document is empty, and an offer is dismissed', () => {
    const hostData = aHostData();
    const documentValue = {
      schemaVersion: '1' as const,
      hostId: hostData.config.hostId,
      overrides: [],
      generatedAt: faker.date.recent().toISOString(),
    };
    const dismissedOfferIds = { [faker.string.uuid()]: faker.string.uuid() };
    const dismissedOffersKey = `atlas.dismissed-development-offers.${hostData.config.hostId}`;

    it('should remove the dismissed offer ids from page session storage when written', async () => {
      driver.given.pageSessionStorageItem(
        dismissedOffersKey,
        JSON.stringify(dismissedOfferIds),
      );

      await writeOverrideDocument({
        tabId: faker.number.int(),
        hostData,
        documentValue,
        scope: 'all',
        dismissedOfferIds,
      });

      expect(
        driver.get.pageSessionStorageItem(dismissedOffersKey),
      ).toBeUndefined();
    });

    it('should remove the persisted document from extension storage when written', async () => {
      driver.given.extensionStorageItem(
        `atlas.overrides.${hostData.config.hostId}`,
        documentValue,
      );

      await writeOverrideDocument({
        tabId: faker.number.int(),
        hostData,
        documentValue,
        scope: 'all',
        dismissedOfferIds,
      });

      expect(
        driver.get.extensionStorageItem(
          `atlas.overrides.${hostData.config.hostId}`,
        ),
      ).toBeUndefined();
    });

    describe('when written', () => {
      beforeEach(async () => {
        await writeOverrideDocument({
          tabId: faker.number.int(),
          hostData,
          documentValue,
          scope: 'all',
          dismissedOfferIds,
        });
      });

      it('should keep the empty document in page local storage when written', () => {
        expect(driver.get.pageLocalStorageItem(DOCUMENT_KEY)).toStrictEqual(
          documentValue,
        );
      });

      it('should store the dismissed offer ids in page local storage when written', () => {
        expect(
          driver.get.pageLocalStorageItem(dismissedOffersKey),
        ).toStrictEqual(dismissedOfferIds);
      });
    });
  });

  it('should remove the document from page local storage when scope is all, the document is empty, and no offer is dismissed', async () => {
    const hostData = aHostData();
    const documentValue = {
      schemaVersion: '1' as const,
      hostId: hostData.config.hostId,
      overrides: [],
      generatedAt: faker.date.recent().toISOString(),
    };

    driver.given.pageLocalStorageItem(
      DOCUMENT_KEY,
      JSON.stringify(documentValue),
    );

    await writeOverrideDocument({
      tabId: faker.number.int(),
      hostData,
      documentValue,
      scope: 'all',
      dismissedOfferIds: {},
    });

    expect(driver.get.pageLocalStorageItem(DOCUMENT_KEY)).toBeUndefined();
  });
});

describe('readDisabledArtifactVersionOverrides', () => {
  let driver: OverrideStorageDriver;

  beforeEach(() => {
    driver = new OverrideStorageDriver();
  });

  it('should return an empty map when nothing is stored', async () => {
    await expect(
      readDisabledArtifactVersionOverrides({
        hostId: faker.string.uuid(),
        tabId: faker.number.int(),
        scope: 'all',
      }),
    ).resolves.toStrictEqual(new Map());
  });

  it('should return the stored manifests keyed by artifact id when scope is all', async () => {
    const hostId = faker.string.uuid();
    const manifest = anAppManifest({ channel: 'pr' });

    driver.given.extensionStorageItem(
      `atlas.disabled-overrides.${hostId}.all`,
      [manifest],
    );

    await expect(
      readDisabledArtifactVersionOverrides({
        hostId,
        tabId: faker.number.int(),
        scope: 'all',
      }),
    ).resolves.toStrictEqual(new Map([[manifest.id, manifest]]));
  });

  it('should return the stored manifests keyed by artifact id when scope is tab', async () => {
    const hostId = faker.string.uuid();
    const tabId = faker.number.int();
    const manifest = anAppManifest({ channel: 'pr' });

    driver.given.extensionStorageItem(
      `atlas.disabled-overrides.${hostId}.tab.${tabId}`,
      [manifest],
    );

    await expect(
      readDisabledArtifactVersionOverrides({ hostId, tabId, scope: 'tab' }),
    ).resolves.toStrictEqual(new Map([[manifest.id, manifest]]));
  });

  it('should ignore the stored values when they are not manifests', async () => {
    const hostId = faker.string.uuid();

    driver.given.extensionStorageItem(
      `atlas.disabled-overrides.${hostId}.all`,
      [{ junk: true }],
    );

    await expect(
      readDisabledArtifactVersionOverrides({
        hostId,
        tabId: faker.number.int(),
        scope: 'all',
      }),
    ).resolves.toStrictEqual(new Map());
  });
});

describe('writeDisabledArtifactVersionOverrides', () => {
  let driver: OverrideStorageDriver;

  beforeEach(() => {
    driver = new OverrideStorageDriver();
  });

  it('should store the manifests under the scoped key when the map has entries', async () => {
    const hostId = faker.string.uuid();
    const manifest = anAppManifest();

    await writeDisabledArtifactVersionOverrides(
      { hostId, tabId: faker.number.int(), scope: 'all' },
      new Map([[manifest.id, manifest]]),
    );

    expect(
      driver.get.extensionStorageItem(`atlas.disabled-overrides.${hostId}.all`),
    ).toStrictEqual([manifest]);
  });

  it('should remove the scoped key when the map is empty', async () => {
    const hostId = faker.string.uuid();

    driver.given.extensionStorageItem(
      `atlas.disabled-overrides.${hostId}.all`,
      [anAppManifest()],
    );

    await writeDisabledArtifactVersionOverrides(
      { hostId, tabId: faker.number.int(), scope: 'all' },
      new Map(),
    );

    expect(
      driver.get.extensionStorageItem(`atlas.disabled-overrides.${hostId}.all`),
    ).toBeUndefined();
  });
});
