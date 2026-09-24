import { faker } from '@faker-js/faker';
import { anAppManifest } from '@atlas/testkit';
import { anOverrideDocument } from '@atlas/testkit/internal';
import {
  ATLAS_DEVELOPMENT_SESSION_SEED_STORAGE_KEY,
  ATLAS_OVERRIDE_DOCUMENT_STORAGE_KEY,
} from './overrides.js';
import { OverridesDriver } from './overrides.driver.js';
import { anOverrideOf } from './overrides.testkit.js';

describe('loadBrowserRuntimeOverrides', () => {
  let driver: OverridesDriver;

  beforeEach(() => {
    driver = new OverridesDriver();
  });

  describe('when no development session and no stored document exist', () => {
    beforeEach(async () => {
      await driver.when.loaded();
    });

    it('should return no overrides when loaded', () => {
      expect(driver.get.overrides()).toEqual([]);
    });

    it('should request the development session once when loaded', () => {
      expect(driver.get.developmentSessionMock()).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the development session returns a document for the host', () => {
    const hostId = faker.string.uuid();
    const manifest = anAppManifest({ channel: 'production' });
    const document = anOverrideDocument({
      hostId,
      overrides: [anOverrideOf(manifest)],
    });

    beforeEach(async () => {
      await driver.given
        .hostId(hostId)
        .given.developmentSessionDocument(document)
        .when.loaded();
    });

    it('should return the session overrides when loaded', () => {
      expect(driver.get.overrides()).toEqual(document.overrides);
    });

    it('should persist the session document in tab storage when loaded', () => {
      expect(driver.get.setItemMock()).toHaveBeenCalledWith(
        ATLAS_OVERRIDE_DOCUMENT_STORAGE_KEY,
        JSON.stringify(document),
      );
    });

    it('should mark the session as seeded in tab storage when loaded', () => {
      expect(driver.get.setItemMock()).toHaveBeenCalledWith(
        ATLAS_DEVELOPMENT_SESSION_SEED_STORAGE_KEY,
        `${hostId}:${document.generatedAt}`,
      );
    });
  });

  describe('when the development session was already seeded in this tab', () => {
    const hostId = faker.string.uuid();
    const sessionDocument = anOverrideDocument({
      hostId,
      overrides: [anOverrideOf(anAppManifest({ channel: 'production' }))],
    });
    const storedDocument = anOverrideDocument({
      hostId,
      overrides: [anOverrideOf(anAppManifest({ channel: 'production' }))],
    });

    beforeEach(async () => {
      await driver.given
        .hostId(hostId)
        .given.developmentSessionDocument(sessionDocument)
        .given.storedDocument(storedDocument)
        .given.storedSeed(`${hostId}:${sessionDocument.generatedAt}`)
        .when.loaded();
    });

    it('should return the stored overrides when loaded', () => {
      expect(driver.get.overrides()).toEqual(storedDocument.overrides);
    });

    it('should not overwrite tab storage when loaded', () => {
      expect(driver.get.setItemMock()).not.toHaveBeenCalled();
    });
  });

  it('should prefer the development session when both a session and a stored document exist and the tab is not seeded', async () => {
    const hostId = faker.string.uuid();
    const sessionDocument = anOverrideDocument({
      hostId,
      overrides: [anOverrideOf(anAppManifest({ channel: 'production' }))],
    });
    const storedDocument = anOverrideDocument({
      hostId,
      overrides: [anOverrideOf(anAppManifest({ channel: 'production' }))],
    });
    await driver.given
      .hostId(hostId)
      .given.developmentSessionDocument(sessionDocument)
      .given.storedDocument(storedDocument)
      .when.loaded();

    expect(driver.get.overrides()).toEqual(sessionDocument.overrides);
  });

  it('should return the stored overrides when only a stored document exists', async () => {
    const hostId = faker.string.uuid();
    const storedDocument = anOverrideDocument({
      hostId,
      overrides: [anOverrideOf(anAppManifest({ channel: 'production' }))],
    });
    await driver.given
      .hostId(hostId)
      .given.storedDocument(storedDocument)
      .when.loaded();

    expect(driver.get.overrides()).toEqual(storedDocument.overrides);
  });

  it('should reject with ATLAS_INVALID_OVERRIDE when the document targets another host', async () => {
    const otherHostId = faker.string.uuid();
    await driver.given
      .developmentSessionDocument(anOverrideDocument({ hostId: otherHostId }))
      .when.loaded();

    expect(driver.get.error()).toMatchObject({
      code: 'ATLAS_INVALID_OVERRIDE',
      message: expect.stringContaining(`targets host "${otherHostId}"`),
    });
  });

  it('should name the app when an override manifest is invalid', async () => {
    const hostId = faker.string.uuid();
    const manifest = anAppManifest({
      channel: 'production',
      version: 'custom-url',
    });
    await driver.given
      .hostId(hostId)
      .given.storedDocument(
        anOverrideDocument({ hostId, overrides: [anOverrideOf(manifest)] }),
      )
      .when.loaded();

    expect(driver.get.error()).toMatchObject({
      message: expect.stringContaining(
        `Atlas override for app "${manifest.id}" is invalid`,
      ),
    });
  });

  it('should reject with ATLAS_INVALID_OVERRIDE when the stored document is not JSON', async () => {
    await driver.given.storedText('{not json').when.loaded();

    expect(driver.get.error()).toMatchObject({
      code: 'ATLAS_INVALID_OVERRIDE',
      message: expect.stringContaining('is not valid JSON'),
    });
  });

  it('should reject with ATLAS_INVALID_OVERRIDE when the stored document has the wrong shape', async () => {
    await driver.given.storedDocument({ schemaVersion: '2' }).when.loaded();

    expect(driver.get.error()).toMatchObject({
      code: 'ATLAS_INVALID_OVERRIDE',
      message: expect.stringContaining('invalid document shape'),
    });
  });
});
