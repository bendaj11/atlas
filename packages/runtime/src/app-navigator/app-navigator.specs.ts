import { AppNavigatorDriver } from './app-navigator.driver.js';

describe('createAppNavigator', () => {
  let driver: AppNavigatorDriver;

  beforeEach(() => {
    driver = new AppNavigatorDriver();
  });

  it('should navigate to headless app path when target id is selected', () => {
    driver.given
      .targets([{ id: 'main-page', path: '/main' }])
      .when.navigateTo('main-page');

    expect(driver.get.navigationPath()).toBe('/main');
  });

  it('should append navigation state when target is a headless app', () => {
    driver.given
      .targets([{ id: 'main-page', path: '/main' }])
      .when.navigateTo('main-page', { tab: 'activity' });

    expect(driver.get.navigationPath()).toBe('/main?tab=activity');
  });

  it('should throw ATLAS_APP_ROUTE_NOT_FOUND when target is not configured', () => {
    driver.given.targets([]).when.navigateTo('missing-page');

    expect(driver.get.error()).toMatchObject({
      code: 'ATLAS_APP_ROUTE_NOT_FOUND',
    });
  });
});
