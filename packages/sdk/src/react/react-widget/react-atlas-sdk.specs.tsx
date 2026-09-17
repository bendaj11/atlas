/** @jest-environment jsdom */

import { faker } from '@faker-js/faker';
import { ReactAtlasSdkDriver } from './react-atlas-sdk.driver.js';

describe('createReactAtlasSdk', () => {
  let driver: ReactAtlasSdkDriver;

  beforeEach(() => {
    driver = new ReactAtlasSdkDriver();
  });

  it('should return the same component when getWidget is called twice with the same id', () => {
    const widgetId = faker.string.uuid();

    expect(driver.get.widget(widgetId)).toBe(driver.get.widget(widgetId));
  });

  it('should throw ATLAS_APP_CONTEXT_MISSING when assetUrl is called without an app context', () => {
    expect(() => driver.get.reactSdk().assetUrl('logo.svg')).toThrow(
      expect.objectContaining({ code: 'ATLAS_APP_CONTEXT_MISSING' }),
    );
  });

  it('should resolve the asset inside the app artifact directory when created with an app context', () => {
    const artifactDirectory = `${faker.internet.url()}/${faker.system.semver()}/`;
    driver.given.remoteEntryUrl(`${artifactDirectory}remoteEntry.json`);

    expect(driver.get.reactSdk().assetUrl('logo.svg')).toBe(
      `${artifactDirectory}logo.svg`,
    );
  });
});
