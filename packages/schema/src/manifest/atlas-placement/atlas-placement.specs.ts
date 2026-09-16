import { faker } from '@faker-js/faker';
import { AtlasPlacementDriver } from './atlas-placement.driver.js';

describe('placementTargetsHost', () => {
  let driver: AtlasPlacementDriver;

  beforeEach(() => {
    driver = new AtlasPlacementDriver();
  });

  it('should return true when placement names that host', () => {
    const hostId = faker.string.uuid();
    driver.when.targetChecked({ placementHostId: hostId, hostId });

    expect(driver.get.result()).toBe(true);
  });

  it('should return true when placement uses the wildcard host', () => {
    driver.when.targetChecked({
      placementHostId: '*',
      hostId: faker.string.uuid(),
    });

    expect(driver.get.result()).toBe(true);
  });

  it('should return false when placement names another host', () => {
    driver.when.targetChecked({
      placementHostId: faker.string.uuid(),
      hostId: faker.string.uuid(),
    });

    expect(driver.get.result()).toBe(false);
  });
});
