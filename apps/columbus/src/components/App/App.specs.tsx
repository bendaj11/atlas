import { faker } from '@faker-js/faker';
import {
  ARTIFACT_OVERRIDE_ROUTE,
  ARTIFACTS_ROUTE,
} from '../../scripts/routing/routes/routes';
import { AppDriver } from './App.driver';

describe('App', () => {
  let driver: AppDriver;

  beforeEach(() => {
    driver = new AppDriver();
  });

  it('should render artifacts list page when the route is the artifacts route', () => {
    driver.given.route(ARTIFACTS_ROUTE).when.rendered();

    expect(driver.get.artifactsListPageMock()).toHaveBeenCalled();
  });

  it('should render artifact override options page when the route is the artifact override options route', () => {
    driver.given.route(ARTIFACT_OVERRIDE_ROUTE).when.rendered();

    expect(driver.get.artifactOverrideEditorPageMock()).toHaveBeenCalled();
  });

  it('should render artifacts list page when the route is unknown', () => {
    const route = `/${faker.lorem.slug()}`;

    driver.given.route(route).when.rendered();

    expect(driver.get.artifactsListPageMock()).toHaveBeenCalled();
  });
});
