import { faker } from '@faker-js/faker';
import { anAppManifest } from '@atlas/testkit';
import { aHostData } from '../../../testkit/host-data.testkit';
import {
  readClearedLocalArtifactIds,
  readDisabledArtifactVersionOverrides,
  readPersistedOverrideDocument,
  writeClearedLocalArtifactIds,
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

  describe('when scope is all and the document has an override', () => {
    const hostData = aHostData();
    const manifest = anAppManifest();
    const documentValue = {
      schemaVersion: '1' as const,
      hostId: hostData.config.hostId,
      overrides: [{ appId: manifest.id, manifest, reason: 'pr' as const }],
      generatedAt: faker.date.recent().toISOString(),
    };

    beforeEach(async () => {
      await writeOverrideDocument({
        tabId: faker.number.int(),
        hostData,
        documentValue,
        scope: 'all',
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

    it('should remove the persisted document when an empty document is written afterwards', async () => {
      await writeOverrideDocument({
        tabId: faker.number.int(),
        hostData,
        documentValue: { ...documentValue, overrides: [] },
        scope: 'all',
      });

      expect(
        driver.get.extensionStorageItem(
          `atlas.overrides.${hostData.config.hostId}`,
        ),
      ).toBeUndefined();
    });

    it('should remove the page document when an empty document with nothing disabled is written afterwards', async () => {
      await writeOverrideDocument({
        tabId: faker.number.int(),
        hostData,
        documentValue: { ...documentValue, overrides: [] },
        scope: 'all',
      });

      expect(driver.get.pageLocalStorageItem(DOCUMENT_KEY)).toBeUndefined();
    });
  });

  describe('when scope is all, the document is empty, and an app is disabled', () => {
    const hostData = aHostData();
    const disabledAppId = faker.string.uuid();
    const documentValue = {
      schemaVersion: '1' as const,
      hostId: hostData.config.hostId,
      overrides: [],
      generatedAt: faker.date.recent().toISOString(),
    };

    beforeEach(async () => {
      await writeOverrideDocument({
        tabId: faker.number.int(),
        hostData,
        documentValue,
        scope: 'all',
        disabledAppIds: [disabledAppId],
      });
    });

    it('should keep the empty document in page local storage when written', () => {
      expect(driver.get.pageLocalStorageItem(DOCUMENT_KEY)).toStrictEqual(
        documentValue,
      );
    });

    it('should store the disabled app ids in page local storage when written', () => {
      expect(
        driver.get.pageLocalStorageItem(
          `atlas.disabled-local-apps.${hostData.config.hostId}`,
        ),
      ).toStrictEqual([disabledAppId]);
    });
  });

  describe('when scope is tab and the document has an override', () => {
    const hostData = aHostData();
    const manifest = anAppManifest();
    const documentValue = {
      schemaVersion: '1' as const,
      hostId: hostData.config.hostId,
      overrides: [{ appId: manifest.id, manifest, reason: 'pr' as const }],
      generatedAt: faker.date.recent().toISOString(),
    };

    beforeEach(async () => {
      await writeOverrideDocument({
        tabId: faker.number.int(),
        hostData,
        documentValue,
        scope: 'tab',
      });
    });

    it('should store the document in page session storage when written', () => {
      expect(driver.get.pageSessionStorageItem(DOCUMENT_KEY)).toStrictEqual(
        documentValue,
      );
    });

    it('should not persist the document in extension storage when written', () => {
      expect(
        driver.get.extensionStorageItem(
          `atlas.overrides.${hostData.config.hostId}`,
        ),
      ).toBeUndefined();
    });
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

describe('readClearedLocalArtifactIds', () => {
  let driver: OverrideStorageDriver;

  beforeEach(() => {
    driver = new OverrideStorageDriver();
  });

  it('should return an empty set when nothing is stored', async () => {
    await expect(
      readClearedLocalArtifactIds({
        hostId: faker.string.uuid(),
        tabId: faker.number.int(),
        scope: 'all',
      }),
    ).resolves.toStrictEqual(new Set());
  });

  it('should return the stored ids when scope is all', async () => {
    const hostId = faker.string.uuid();
    const artifactId = faker.string.uuid();

    driver.given.extensionStorageItem(
      `atlas.suppressed-artifacts.${hostId}.all`,
      [artifactId],
    );

    await expect(
      readClearedLocalArtifactIds({
        hostId,
        tabId: faker.number.int(),
        scope: 'all',
      }),
    ).resolves.toStrictEqual(new Set([artifactId]));
  });

  it('should ignore the stored values when they are not non-empty strings', async () => {
    const hostId = faker.string.uuid();
    const artifactId = faker.string.uuid();

    driver.given.extensionStorageItem(
      `atlas.suppressed-artifacts.${hostId}.all`,
      [artifactId, '', faker.number.int()],
    );

    await expect(
      readClearedLocalArtifactIds({
        hostId,
        tabId: faker.number.int(),
        scope: 'all',
      }),
    ).resolves.toStrictEqual(new Set([artifactId]));
  });
});

describe('writeClearedLocalArtifactIds', () => {
  let driver: OverrideStorageDriver;

  beforeEach(() => {
    driver = new OverrideStorageDriver();
  });

  it('should store the ids under the scoped key when the set has entries', async () => {
    const hostId = faker.string.uuid();
    const tabId = faker.number.int();
    const artifactId = faker.string.uuid();

    await writeClearedLocalArtifactIds(
      { hostId, tabId, scope: 'tab' },
      new Set([artifactId]),
    );

    expect(
      driver.get.extensionStorageItem(
        `atlas.suppressed-artifacts.${hostId}.tab.${tabId}`,
      ),
    ).toStrictEqual([artifactId]);
  });

  it('should remove the scoped key when the set is empty', async () => {
    const hostId = faker.string.uuid();

    driver.given.extensionStorageItem(
      `atlas.suppressed-artifacts.${hostId}.all`,
      [faker.string.uuid()],
    );

    await writeClearedLocalArtifactIds(
      { hostId, tabId: faker.number.int(), scope: 'all' },
      new Set(),
    );

    expect(
      driver.get.extensionStorageItem(
        `atlas.suppressed-artifacts.${hostId}.all`,
      ),
    ).toBeUndefined();
  });
});
