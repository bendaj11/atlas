/** @jest-environment jsdom */
import { faker } from '@faker-js/faker';
import { jest } from '@jest/globals';
import { MockAtlasEnvironmentProviderDriver } from './mock-atlas-environment-provider.driver.js';

describe('MockAtlasEnvironmentProvider', () => {
  let driver: MockAtlasEnvironmentProviderDriver;

  beforeEach(() => {
    driver = new MockAtlasEnvironmentProviderDriver();
  });

  describe('when rendered with an app', () => {
    beforeEach(() => {
      driver.when.rendered();
    });

    it('should provide the document head as style target when rendered', () => {
      expect(driver.get.result().styleTarget).toBe(document.head);
    });

    it('should resolve asset urls inside the mocked app artifact when an asset url is requested', () => {
      const artifactDirectory = new URL(
        '.',
        driver.get.environment().context?.manifest.remoteEntryUrl,
      ).href;

      expect(driver.get.result().atlas.assetUrl('logo.svg')).toBe(
        `${artifactDirectory}logo.svg`,
      );
    });
  });

  it('should report not ready when the app defers its loaded state', () => {
    driver.when.appLoadedRendered();

    expect(driver.get.environment().isReady()).toBe(false);
  });

  it('should expose the mocked host extension through useAtlasSdk when the extension is mocked', () => {
    const greeting = faker.lorem.sentence();
    const greet = jest.fn(() => greeting);

    driver.given.overrides({ sdk: { greet } }).when.rendered();

    expect(driver.get.result().atlas.greet()).toBe(greeting);
  });

  it('should re-render with updated host data when host data is updated', () => {
    const userName = faker.person.firstName();

    driver.given
      .overrides({ sdk: { hostData: { userName: faker.person.firstName() } } })
      .when.rendered();

    driver.when.hostDataUpdated(userName);

    expect(driver.get.result().atlas.hostData.userName).toBe(userName);
  });

  it('should throw ATLAS_APP_CONTEXT_MISSING when an asset url is requested when the app is null', () => {
    driver.given.overrides({ app: null }).when.rendered();

    expect(() => driver.get.result().atlas.assetUrl('logo.svg')).toThrow(
      expect.objectContaining({ code: 'ATLAS_APP_CONTEXT_MISSING' }),
    );
  });
});
