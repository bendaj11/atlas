import { faker } from '@faker-js/faker';
import type { AtlasConfig } from '@atlas/schema';
import { AtlasConfigDriver } from './atlas-config.driver.js';

describe('atlas-config', () => {
  let driver: AtlasConfigDriver;

  beforeEach(() => {
    driver = new AtlasConfigDriver();
  });

  describe('isHostConfig', () => {
    it('should return true when type is host', () => {
      driver.given.config(aConfig({ type: 'host' }));

      expect(driver.get.isHost()).toBe(true);
    });

    it('should return false when type is app', () => {
      driver.given.config(aConfig({ type: 'app' }));

      expect(driver.get.isHost()).toBe(false);
    });

    it.each(['resourcesTimeoutMs', 'resourcesRetryCount'])(
      'should return true when type is absent and %s is present',
      (field) => {
        driver.given.config(aConfig({ [field]: faker.number.int() }));

        expect(driver.get.isHost()).toBe(true);
      },
    );

    it('should return false when type and host fields are absent', () => {
      driver.given.config(aConfig({}));

      expect(driver.get.isHost()).toBe(false);
    });
  });

  describe('assertAppConfig', () => {
    it('should return config when config is an app', () => {
      const config = aConfig({ type: 'app' });
      driver.given.config(config);

      expect(driver.get.appConfig()).toBe(config);
    });

    it('should throw with config id when config is a host', () => {
      const id = faker.string.uuid();
      driver.given.config(aConfig({ type: 'host', id }));

      expect(() => driver.get.appConfig()).toThrow(
        `Atlas build expects an app config for "${id}", but received a host config.`,
      );
    });
  });
});

function aConfig(overrides: Record<string, unknown>): AtlasConfig {
  return {
    id: faker.string.uuid(),
    framework: faker.helpers.arrayElement(['react', 'angular']),
    ...overrides,
  } as AtlasConfig;
}
