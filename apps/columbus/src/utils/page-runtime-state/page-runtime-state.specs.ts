import { faker } from '@faker-js/faker';
import {
  readDismissedOfferIds,
  readRuntimeErrors,
  readStoredOverrides,
  readVisibleAppIds,
} from './page-runtime-state';
import { PageRuntimeStateDriver } from './page-runtime-state.driver';

describe('readStoredOverrides', () => {
  let driver: PageRuntimeStateDriver;

  beforeEach(() => {
    driver = new PageRuntimeStateDriver();
  });

  it('should return nothing when no document is stored', () => {
    expect(
      readStoredOverrides(faker.word.noun(), faker.string.uuid()),
    ).toStrictEqual({ overrides: undefined, overrideScope: undefined });
  });

  it('should read the document with scope all when it is in local storage under the host id', () => {
    const documentKey = faker.word.noun();
    const document = {
      schemaVersion: '1',
      hostId: faker.string.uuid(),
      overrides: [],
      generatedAt: faker.date.recent().toISOString(),
    };

    driver.given.pageLocalStorage(documentKey, JSON.stringify(document));

    expect(readStoredOverrides(documentKey, document.hostId)).toStrictEqual({
      overrides: document,
      overrideScope: 'all',
    });
  });

  it('should read the document with scope tab when it is in session storage under the host id', () => {
    const documentKey = faker.word.noun();
    const document = {
      schemaVersion: '1',
      hostId: faker.string.uuid(),
      overrides: [],
      generatedAt: faker.date.recent().toISOString(),
    };

    driver.given.pageSessionStorage(documentKey, JSON.stringify(document));

    expect(readStoredOverrides(documentKey, document.hostId)).toStrictEqual({
      overrides: document,
      overrideScope: 'tab',
    });
  });

  it('should prefer session storage when both storages hold a document', () => {
    const documentKey = faker.word.noun();
    const hostId = faker.string.uuid();
    const tabDocument = {
      schemaVersion: '1',
      hostId,
      overrides: [],
      generatedAt: faker.date.recent().toISOString(),
    };

    driver.given
      .pageLocalStorage(
        documentKey,
        JSON.stringify({ ...tabDocument, generatedAt: faker.date.past() }),
      )
      .given.pageSessionStorage(documentKey, JSON.stringify(tabDocument));

    expect(readStoredOverrides(documentKey, hostId)).toStrictEqual({
      overrides: tabDocument,
      overrideScope: 'tab',
    });
  });

  it('should drop the document when it belongs to another host', () => {
    const documentKey = faker.word.noun();

    driver.given.pageLocalStorage(
      documentKey,
      JSON.stringify({
        schemaVersion: '1',
        hostId: faker.string.uuid(),
        overrides: [],
        generatedAt: faker.date.recent().toISOString(),
      }),
    );

    expect(readStoredOverrides(documentKey, faker.string.uuid())).toStrictEqual(
      { overrides: undefined, overrideScope: 'all' },
    );
  });

  it('should drop the document when it is not an override document', () => {
    const documentKey = faker.word.noun();

    driver.given.pageLocalStorage(documentKey, JSON.stringify(null));

    expect(readStoredOverrides(documentKey, faker.string.uuid())).toStrictEqual(
      { overrides: undefined, overrideScope: 'all' },
    );
  });

  it('should keep the scope when the stored value is not json', () => {
    const documentKey = faker.word.noun();

    driver.given.pageLocalStorage(documentKey, '{oops');

    expect(readStoredOverrides(documentKey, faker.string.uuid())).toStrictEqual(
      { overrides: undefined, overrideScope: 'all' },
    );
  });
});

describe('readDismissedOfferIds', () => {
  let driver: PageRuntimeStateDriver;

  beforeEach(() => {
    driver = new PageRuntimeStateDriver();
  });

  it('should return no offer ids when nothing is stored', () => {
    expect(readDismissedOfferIds(faker.string.uuid())).toStrictEqual({});
  });

  it('should return the offer ids when they are in local storage under the host id', () => {
    const hostId = faker.string.uuid();
    const dismissedOfferIds = { [faker.string.uuid()]: faker.string.uuid() };

    driver.given.pageLocalStorage(
      `atlas.dismissed-development-offers.${hostId}`,
      JSON.stringify(dismissedOfferIds),
    );

    expect(readDismissedOfferIds(hostId)).toStrictEqual(dismissedOfferIds);
  });

  it('should return the offer ids when they are in session storage under the host id', () => {
    const hostId = faker.string.uuid();
    const dismissedOfferIds = { [faker.string.uuid()]: faker.string.uuid() };

    driver.given.pageSessionStorage(
      `atlas.dismissed-development-offers.${hostId}`,
      JSON.stringify(dismissedOfferIds),
    );

    expect(readDismissedOfferIds(hostId)).toStrictEqual(dismissedOfferIds);
  });

  it('should prefer session storage when both storages hold offer ids', () => {
    const hostId = faker.string.uuid();
    const tabOfferIds = { [faker.string.uuid()]: faker.string.uuid() };

    driver.given
      .pageLocalStorage(
        `atlas.dismissed-development-offers.${hostId}`,
        JSON.stringify({ [faker.string.uuid()]: faker.string.uuid() }),
      )
      .given.pageSessionStorage(
        `atlas.dismissed-development-offers.${hostId}`,
        JSON.stringify(tabOfferIds),
      );

    expect(readDismissedOfferIds(hostId)).toStrictEqual(tabOfferIds);
  });

  it('should return no offer ids when the stored value is not an offer id map', () => {
    const hostId = faker.string.uuid();

    driver.given.pageLocalStorage(
      `atlas.dismissed-development-offers.${hostId}`,
      JSON.stringify(null),
    );

    expect(readDismissedOfferIds(hostId)).toStrictEqual({});
  });
});

describe('readRuntimeErrors', () => {
  let driver: PageRuntimeStateDriver;

  beforeEach(() => {
    driver = new PageRuntimeStateDriver();
  });

  it('should attribute the error to the app when the element carries an app id', () => {
    const appId = faker.string.uuid();
    const message = faker.lorem.sentence();

    driver.given.pageBody(
      `<div data-atlas-state="error" data-atlas-app-id="${appId}">${message}</div>`,
    );

    expect(readRuntimeErrors()).toStrictEqual([{ artifactId: appId, message }]);
  });

  it('should report an unattributed error when the element has no app id', () => {
    const message = faker.lorem.sentence();

    driver.given.pageBody(`<div data-atlas-state="error">${message}</div>`);

    expect(readRuntimeErrors()).toStrictEqual([{ message }]);
  });

  it('should use the fallback message when the element is empty', () => {
    driver.given.pageBody('<div data-atlas-state="error"></div>');

    expect(readRuntimeErrors()).toStrictEqual([
      { message: 'Unknown app error' },
    ]);
  });
});

describe('readVisibleAppIds', () => {
  let driver: PageRuntimeStateDriver;

  beforeEach(() => {
    driver = new PageRuntimeStateDriver();
  });

  it('should list nothing when no containers exist', () => {
    expect(readVisibleAppIds()).toStrictEqual([]);
  });

  it('should list each app once when containers repeat', () => {
    const repeated = faker.string.uuid();
    const other = faker.string.uuid();

    driver.given.pageBody(
      `<div data-atlas-app-id="${repeated}"></div><div data-atlas-app-id="${repeated}"></div><div data-atlas-app-id="${other}"></div>`,
    );

    expect(readVisibleAppIds()).toStrictEqual([repeated, other]);
  });
});
