import { faker } from '@faker-js/faker';
import { aHostManifest, anAppManifest } from '@atlas/testkit';
import { DevelopmentOffersDriver } from './development-offers.driver';
import { readDevelopmentOffers } from './development-offers';

describe('readDevelopmentOffers', () => {
  let driver: DevelopmentOffersDriver;

  beforeEach(() => {
    driver = new DevelopmentOffersDriver();
  });

  it('should send the development session request for the host and page url when no control port is remembered', async () => {
    const hostId = faker.string.uuid();

    driver.given
      .pagePath(`/${faker.word.noun()}`)
      .given.runtimeResponse({ document: null });

    await readDevelopmentOffers(hostId);

    expect(driver.get.runtimeMessage()).toHaveBeenCalledWith({
      type: 'atlas.load-development-session',
      hostId,
      previewUrl: driver.get.pageUrl(),
    });
  });

  it('should send the remembered control port with the development session request when a control port is remembered', async () => {
    const hostId = faker.string.uuid();
    const controlPort = faker.number.int({ min: 1, max: 65_535 });

    driver.given
      .sessionStorageItem('atlas.development-control-port', String(controlPort))
      .given.runtimeResponse({ document: null });

    await readDevelopmentOffers(hostId);

    expect(driver.get.runtimeMessage()).toHaveBeenCalledWith({
      type: 'atlas.load-development-session',
      hostId,
      previewUrl: driver.get.pageUrl(),
      controlPort,
    });
  });

  it('should return the offered overrides with their offer ids when the session document belongs to the host', async () => {
    const hostId = faker.string.uuid();
    const manifest = anAppManifest();
    const overrides = [{ appId: manifest.id, manifest, reason: 'pr' as const }];
    const offerIds = { [manifest.id]: faker.string.uuid() };

    driver.given.runtimeResponse({
      document: {
        schemaVersion: '1',
        hostId,
        overrides,
        generatedAt: faker.date.recent().toISOString(),
        offerIds,
      },
    });

    expect(await readDevelopmentOffers(hostId)).toStrictEqual({
      overrides,
      offerIds,
    });
  });

  it('should return the offered host override when the session document of the host has one', async () => {
    const hostId = faker.string.uuid();
    const hostOverride = aHostManifest({ id: hostId });
    const offerIds = { [hostId]: faker.string.uuid() };

    driver.given.runtimeResponse({
      document: {
        schemaVersion: '1',
        hostId,
        overrides: [],
        hostOverride,
        generatedAt: faker.date.recent().toISOString(),
        offerIds,
      },
    });

    expect(await readDevelopmentOffers(hostId)).toStrictEqual({
      overrides: [],
      hostOverride,
      offerIds,
    });
  });

  it('should return no offer ids when the session document of the host carries invalid offer ids', async () => {
    const hostId = faker.string.uuid();

    driver.given.runtimeResponse({
      document: {
        schemaVersion: '1',
        hostId,
        overrides: [],
        generatedAt: faker.date.recent().toISOString(),
        offerIds: null,
      },
    });

    expect((await readDevelopmentOffers(hostId))?.offerIds).toStrictEqual({});
  });

  it('should return nothing when the session document belongs to another host', async () => {
    driver.given.runtimeResponse({
      document: {
        schemaVersion: '1',
        hostId: faker.string.uuid(),
        overrides: [],
        generatedAt: faker.date.recent().toISOString(),
        offerIds: {},
      },
    });

    expect(await readDevelopmentOffers(faker.string.uuid())).toBeUndefined();
  });

  it('should return nothing when the session document is not an override document', async () => {
    driver.given.runtimeResponse({ document: null });

    expect(await readDevelopmentOffers(faker.string.uuid())).toBeUndefined();
  });

  it('should return nothing when the background reports an error', async () => {
    driver.given.runtimeResponse({ error: faker.lorem.sentence() });

    expect(await readDevelopmentOffers(faker.string.uuid())).toBeUndefined();
  });

  it('should return nothing when the request is rejected', async () => {
    driver.given.runtimeFailure(new Error(faker.lorem.sentence()));

    expect(await readDevelopmentOffers(faker.string.uuid())).toBeUndefined();
  });
});
