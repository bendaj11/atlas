import { ARTIFACT_CONFIGURATION_ROUTE } from '../../scripts/routing/routes/routes';
import { AppDriver } from './App.driver';

describe('App', () => {
  let driver: AppDriver;

  beforeEach(() => {
    driver = new AppDriver();
  });

  it('should load the host when mounted', () => {
    driver.when.rendered();

    expect(driver.get.loadHostCount()).toBe(1);
  });

  it('should show the artifacts page when at the root route', async () => {
    driver.when.rendered();

    expect(await driver.get.page('artifacts page')).not.toBeNull();
  });

  it('should show the configuration page when at the configuration route', async () => {
    driver.given.route(ARTIFACT_CONFIGURATION_ROUTE).when.rendered();

    expect(await driver.get.page('configuration page')).not.toBeNull();
  });

  it('should fall back to the artifacts page when the route is unknown', async () => {
    driver.given.route('/nowhere').when.rendered();

    expect(await driver.get.page('artifacts page')).not.toBeNull();
  });
});
