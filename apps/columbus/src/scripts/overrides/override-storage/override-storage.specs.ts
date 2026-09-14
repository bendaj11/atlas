import { aManifest } from '../../../types/app.testkit';
import { OverrideStorageDriver } from './override-storage.driver';

const DOCUMENT_KEY = 'atlas.runtime-overrides';

describe('readPersistedOverrideDocument', () => {
  let driver: OverrideStorageDriver;

  beforeEach(() => {
    driver = new OverrideStorageDriver();
  });

  it('should return nothing when no document is stored', async () => {
    await driver.when.persistedDocumentRead();

    expect(driver.get.persistedDocument()).toBeUndefined();
  });

  it('should return the document when a valid one is stored for the host', async () => {
    const document = {
      schemaVersion: '1',
      hostId: driver.get.hostId(),
      overrides: [],
      generatedAt: '2026-01-01T00:00:00.000Z',
    };

    await driver.given
      .extensionStorage(`atlas.overrides.${driver.get.hostId()}`, document)
      .when.persistedDocumentRead();

    expect(driver.get.persistedDocument()).toEqual(document);
  });

  it('should return nothing when the stored document belongs to another host', async () => {
    await driver.given
      .extensionStorage(`atlas.overrides.${driver.get.hostId()}`, {
        schemaVersion: '1',
        hostId: 'other',
        overrides: [],
        generatedAt: '2026-01-01T00:00:00.000Z',
      })
      .when.persistedDocumentRead();

    expect(driver.get.persistedDocument()).toBeUndefined();
  });
});

describe('writeOverrideDocument', () => {
  let driver: OverrideStorageDriver;

  beforeEach(() => {
    driver = new OverrideStorageDriver();
  });

  it('should store the document in page local storage when scope is all', async () => {
    const override = {
      appId: 'orders',
      manifest: aManifest({ id: 'orders' }),
      reason: 'pr' as const,
    };

    await driver.when.documentWritten([override]);

    expect(driver.get.pageLocalStorage(DOCUMENT_KEY)).toMatchObject({
      overrides: [{ appId: 'orders' }],
    });
  });

  it('should store the document in page session storage when scope is tab', async () => {
    const override = {
      appId: 'orders',
      manifest: aManifest({ id: 'orders' }),
      reason: 'pr' as const,
    };

    await driver.given.scope('tab').when.documentWritten([override]);

    expect(driver.get.pageSessionStorage(DOCUMENT_KEY)).toMatchObject({
      overrides: [{ appId: 'orders' }],
    });
  });

  it('should keep an empty document in the page when a local override is only suppressed', async () => {
    await driver.when.documentWritten([], ['orders']);

    expect(driver.get.pageLocalStorage(DOCUMENT_KEY)).toMatchObject({
      overrides: [],
    });
  });

  it('should store disabled app ids in the page when some are given', async () => {
    await driver.when.documentWritten([], ['orders']);

    expect(
      driver.get.pageLocalStorage(
        `atlas.disabled-local-apps.${driver.get.hostId()}`,
      ),
    ).toEqual(['orders']);
  });

  it('should remove the page document when there are no overrides and nothing disabled', async () => {
    await driver.when.documentWritten([], ['orders']);

    await driver.when.documentWritten([]);

    expect(driver.get.pageLocalStorage(DOCUMENT_KEY)).toBeUndefined();
  });

  it('should persist the document in extension storage when scope is all and overrides exist', async () => {
    const override = {
      appId: 'orders',
      manifest: aManifest({ id: 'orders' }),
      reason: 'pr' as const,
    };

    await driver.when.documentWritten([override]);

    expect(
      driver.get.extensionStorage(`atlas.overrides.${driver.get.hostId()}`),
    ).toMatchObject({
      overrides: [{ appId: 'orders' }],
    });
  });

  it('should drop the persisted document when scope is all and no overrides remain', async () => {
    const override = {
      appId: 'orders',
      manifest: aManifest({ id: 'orders' }),
      reason: 'pr' as const,
    };
    await driver.when.documentWritten([override]);

    await driver.when.documentWritten([]);

    expect(
      driver.get.extensionStorage(`atlas.overrides.${driver.get.hostId()}`),
    ).toBeUndefined();
  });

  it('should not touch extension storage when scope is tab', async () => {
    const override = {
      appId: 'orders',
      manifest: aManifest({ id: 'orders' }),
      reason: 'pr' as const,
    };

    await driver.given.scope('tab').when.documentWritten([override]);

    expect(
      driver.get.extensionStorage(`atlas.overrides.${driver.get.hostId()}`),
    ).toBeUndefined();
  });
});

describe('disabled overrides storage', () => {
  let driver: OverrideStorageDriver;

  beforeEach(() => {
    driver = new OverrideStorageDriver();
  });

  it('should read back written overrides keyed by artifact', async () => {
    const manifest = aManifest({ kind: 'app', id: 'orders' });

    await driver.when.disabledOverridesWritten(
      new Map([['app:orders', manifest]]),
    );
    await driver.when.disabledOverridesRead();

    expect(driver.get.disabledOverrides()).toEqual(
      new Map([['app:orders', manifest]]),
    );
  });

  it('should read an empty map when nothing was written', async () => {
    await driver.when.disabledOverridesRead();

    expect(driver.get.disabledOverrides()).toEqual(new Map());
  });

  it('should clear the entry when an empty map is written', async () => {
    await driver.when.disabledOverridesWritten(
      new Map([['app:orders', aManifest()]]),
    );
    await driver.when.disabledOverridesWritten(new Map());

    expect(
      driver.get.extensionStorage(
        `atlas.disabled-overrides.${driver.get.hostId()}.all`,
      ),
    ).toBeUndefined();
  });

  it('should ignore stored values that are not manifests', async () => {
    await driver.given
      .extensionStorage(`atlas.disabled-overrides.${driver.get.hostId()}.all`, [
        { junk: true },
      ])
      .when.disabledOverridesRead();

    expect(driver.get.disabledOverrides()).toEqual(new Map());
  });
});

describe('suppressed artifact ids storage', () => {
  let driver: OverrideStorageDriver;

  beforeEach(() => {
    driver = new OverrideStorageDriver();
  });

  it('should read back written ids', async () => {
    await driver.when.suppressedArtifactIdsWritten(new Set(['orders']));
    await driver.when.suppressedArtifactIdsRead();

    expect(driver.get.suppressedArtifactIds()).toEqual(new Set(['orders']));
  });

  it('should clear the entry when an empty set is written', async () => {
    await driver.when.suppressedArtifactIdsWritten(new Set(['orders']));
    await driver.when.suppressedArtifactIdsWritten(new Set());

    expect(
      driver.get.extensionStorage(
        `atlas.suppressed-artifacts.${driver.get.hostId()}.all`,
      ),
    ).toBeUndefined();
  });

  it('should ignore stored values that are not non-empty strings', async () => {
    await driver.given
      .extensionStorage(
        `atlas.suppressed-artifacts.${driver.get.hostId()}.all`,
        ['orders', '', 3],
      )
      .when.suppressedArtifactIdsRead();

    expect(driver.get.suppressedArtifactIds()).toEqual(new Set(['orders']));
  });
});
