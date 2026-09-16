import { faker } from '@faker-js/faker';
import { AppAssetsDriver } from './app-assets.driver.js';

describe('createAtlasAppAssetFacade', () => {
  let driver: AppAssetsDriver;

  beforeEach(() => {
    driver = new AppAssetsDriver();
  });

  describe('when the app is published under a versioned directory', () => {
    const artifactDirectory = `${faker.internet.url()}/apps/${faker.lorem.slug()}/${faker.system.semver()}/`;

    beforeEach(() => {
      driver.given.remoteEntryUrl(`${artifactDirectory}remoteEntry.json`);
    });

    it('should return the artifact directory when assetBaseUrl is called', () => {
      expect(driver.get.assets().assetBaseUrl()).toBe(artifactDirectory);
    });

    it('should resolve a relative path inside the artifact directory when assetUrl is called', () => {
      const path = `${faker.lorem.slug()}/${faker.system.commonFileName('png')}`;

      expect(driver.get.assets().assetUrl(path)).toBe(
        `${artifactDirectory}${path}`,
      );
    });

    it('should throw ATLAS_ASSET_PATH_OUTSIDE_ARTIFACT when assetUrl is called with a path that escapes the directory', () => {
      expect(() => driver.get.assets().assetUrl('../shared/plane.png')).toThrow(
        expect.objectContaining({ code: 'ATLAS_ASSET_PATH_OUTSIDE_ARTIFACT' }),
      );
    });
  });
});
