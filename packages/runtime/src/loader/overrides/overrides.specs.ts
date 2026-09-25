/** @jest-environment jsdom */
import { faker } from '@faker-js/faker';
import { anAppManifest } from '@atlas/testkit';
import { anOverrideDocument } from '@atlas/testkit/internal';
import { loadBrowserRuntimeOverrides } from './overrides.js';
import { OverridesDriver } from './overrides.driver.js';
import { anOverrideOf } from './overrides.testkit.js';

describe('loadBrowserRuntimeOverrides', () => {
  let driver: OverridesDriver;

  beforeEach(() => {
    driver = new OverridesDriver();
  });

  it('should return no overrides when no development session and no stored document exist', async () => {
    const hostId = faker.string.uuid();

    await expect(
      loadBrowserRuntimeOverrides({ hostId, ...driver.get.dependencies() }),
    ).resolves.toStrictEqual([]);
  });

  it('should return the offered overrides when the development session offers them and nothing is stored', async () => {
    const hostId = faker.string.uuid();
    const offered = anOverrideOf(anAppManifest({ channel: 'local' }));

    driver.given.developmentSession({
      ...anOverrideDocument({ hostId, overrides: [offered] }),
      offerIds: { [offered.appId]: faker.date.past().toISOString() },
    });

    await expect(
      loadBrowserRuntimeOverrides({ hostId, ...driver.get.dependencies() }),
    ).resolves.toStrictEqual([offered]);
  });

  it('should skip an offered override when its offer was dismissed for every tab', async () => {
    const hostId = faker.string.uuid();
    const offered = anOverrideOf(anAppManifest({ channel: 'local' }));
    const offerId = faker.date.past().toISOString();

    driver.given
      .developmentSession({
        ...anOverrideDocument({ hostId, overrides: [offered] }),
        offerIds: { [offered.appId]: offerId },
      })
      .given.originDismissedOffers(hostId, { [offered.appId]: offerId });

    await expect(
      loadBrowserRuntimeOverrides({ hostId, ...driver.get.dependencies() }),
    ).resolves.toStrictEqual([]);
  });

  it('should return an offered override when only an earlier offer of its app was dismissed', async () => {
    const hostId = faker.string.uuid();
    const offered = anOverrideOf(anAppManifest({ channel: 'local' }));

    driver.given
      .developmentSession({
        ...anOverrideDocument({ hostId, overrides: [offered] }),
        offerIds: { [offered.appId]: faker.date.recent().toISOString() },
      })
      .given.originDismissedOffers(hostId, {
        [offered.appId]: faker.date.past().toISOString(),
      });

    await expect(
      loadBrowserRuntimeOverrides({ hostId, ...driver.get.dependencies() }),
    ).resolves.toStrictEqual([offered]);
  });

  it('should return the stored overrides with the offered ones when both exist', async () => {
    const hostId = faker.string.uuid();
    const stored = anOverrideOf(anAppManifest({ channel: 'production' }));
    const offered = anOverrideOf(anAppManifest({ channel: 'local' }));

    driver.given
      .developmentSession({
        ...anOverrideDocument({ hostId, overrides: [offered] }),
        offerIds: { [offered.appId]: faker.date.past().toISOString() },
      })
      .given.originDocument(anOverrideDocument({ hostId, overrides: [stored] }));

    await expect(
      loadBrowserRuntimeOverrides({ hostId, ...driver.get.dependencies() }),
    ).resolves.toStrictEqual([stored, offered]);
  });

  it('should return only the stored overrides when no development session exists', async () => {
    const hostId = faker.string.uuid();
    const stored = anOverrideOf(anAppManifest({ channel: 'production' }));

    driver.given.originDocument(
      anOverrideDocument({ hostId, overrides: [stored] }),
    );

    await expect(
      loadBrowserRuntimeOverrides({ hostId, ...driver.get.dependencies() }),
    ).resolves.toStrictEqual([stored]);
  });

  it('should prefer the tab document over the origin document when both exist', async () => {
    const hostId = faker.string.uuid();
    const tabOverride = anOverrideOf(anAppManifest({ channel: 'production' }));

    driver.given
      .tabDocument(anOverrideDocument({ hostId, overrides: [tabOverride] }))
      .given.originDocument(
        anOverrideDocument({
          hostId,
          overrides: [anOverrideOf(anAppManifest({ channel: 'production' }))],
        }),
      );

    await expect(
      loadBrowserRuntimeOverrides({ hostId, ...driver.get.dependencies() }),
    ).resolves.toStrictEqual([tabOverride]);
  });

  it('should reject with ATLAS_INVALID_OVERRIDE when the development session targets another host', async () => {
    const otherHostId = faker.string.uuid();

    driver.given.developmentSession({
      ...anOverrideDocument({ hostId: otherHostId }),
      offerIds: {},
    });

    await expect(
      loadBrowserRuntimeOverrides({
        hostId: faker.string.uuid(),
        ...driver.get.dependencies(),
      }),
    ).rejects.toMatchObject({
      code: 'ATLAS_INVALID_OVERRIDE',
      message: expect.stringContaining(`targets host "${otherHostId}"`),
    });
  });

  it('should name the app when a stored override manifest is invalid', async () => {
    const hostId = faker.string.uuid();
    const manifest = anAppManifest({
      channel: 'production',
      version: 'custom-url',
    });

    driver.given.tabDocument(
      anOverrideDocument({ hostId, overrides: [anOverrideOf(manifest)] }),
    );

    await expect(
      loadBrowserRuntimeOverrides({ hostId, ...driver.get.dependencies() }),
    ).rejects.toMatchObject({
      message: expect.stringContaining(
        `Atlas override for app "${manifest.id}" is invalid`,
      ),
    });
  });

  it('should reject with ATLAS_INVALID_OVERRIDE when the stored document is not JSON', async () => {
    driver.given.tabText(`{${faker.lorem.word()}`);

    await expect(
      loadBrowserRuntimeOverrides({
        hostId: faker.string.uuid(),
        ...driver.get.dependencies(),
      }),
    ).rejects.toMatchObject({
      code: 'ATLAS_INVALID_OVERRIDE',
      message: expect.stringContaining('is not valid JSON'),
    });
  });

  it('should reject with ATLAS_INVALID_OVERRIDE when the stored document has the wrong shape', async () => {
    driver.given.tabDocument(null);

    await expect(
      loadBrowserRuntimeOverrides({
        hostId: faker.string.uuid(),
        ...driver.get.dependencies(),
      }),
    ).rejects.toMatchObject({
      code: 'ATLAS_INVALID_OVERRIDE',
      message: expect.stringContaining('invalid document shape'),
    });
  });
});
