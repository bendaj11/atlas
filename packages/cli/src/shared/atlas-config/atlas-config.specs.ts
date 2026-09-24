import { faker } from '@faker-js/faker';
import type { AtlasConfig } from '@atlas/schema';
import { aHostConfig, anAppConfig } from '@atlas/testkit/internal';
import { AtlasConfigDriver } from './atlas-config.driver.js';

describe('atlas-config', () => {
  let driver: AtlasConfigDriver;

  beforeEach(() => {
    driver = new AtlasConfigDriver();
  });

  describe('isHostConfig', () => {
    it('should return true when type is host', () => {
      driver.given.config(aHostConfig());

      expect(driver.get.isHost()).toBe(true);
    });

    it('should return false when type is app', () => {
      driver.given.config(anAppConfig());

      expect(driver.get.isHost()).toBe(false);
    });

    it.each(['resourcesTimeoutMs', 'resourcesRetryCount'])(
      'should return true when type is absent and %s is present',
      (field) => {
        driver.given.config({
          ...aHostConfig({ type: undefined }),
          [field]: faker.number.int(),
        } as AtlasConfig);

        expect(driver.get.isHost()).toBe(true);
      },
    );

    it('should return false when type and host fields are absent', () => {
      driver.given.config(anAppConfig({ type: undefined }));

      expect(driver.get.isHost()).toBe(false);
    });
  });

  describe('assertAppConfig', () => {
    it('should return config when config is an app', () => {
      const config = anAppConfig();
      driver.given.config(config);

      expect(driver.get.appConfig()).toBe(config);
    });

    it('should throw with config id when config is a host', () => {
      const id = faker.string.uuid();
      driver.given.config(aHostConfig({ id }));

      expect(() => driver.get.appConfig()).toThrow(
        `Atlas build expects an app config for "${id}", but received a host config.`,
      );
    });
  });
});
