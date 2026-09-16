import { faker } from '@faker-js/faker';
import {
  ARTIFACT_CONFIGURATION_ROUTE,
  ARTIFACTS_ROUTE,
} from '../../scripts/routing/routes/routes';
import { AppDriver } from './App.driver';

describe('App', () => {
  let driver: AppDriver;

  beforeEach(() => {
    driver = new AppDriver();
  });

  it('should render artifacts overrides page when the route is the artifacts route', () => {
    driver.given.route(ARTIFACTS_ROUTE).when.rendered();

    expect(driver.get.artifactsOverridesPageMock()).toHaveBeenCalled();
  });

  it('should render artifact configuration page when the route is the artifact configuration route', () => {
    driver.given.route(ARTIFACT_CONFIGURATION_ROUTE).when.rendered();

    expect(driver.get.artifactConfigurationPageMock()).toHaveBeenCalled();
  });

  it('should render artifacts overrides page when the route is unknown', () => {
    const route = `/${faker.lorem.slug()}`;

    driver.given.route(route).when.rendered();

    expect(driver.get.artifactsOverridesPageMock()).toHaveBeenCalled();
  });
});
