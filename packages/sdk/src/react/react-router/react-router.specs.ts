import { ReactRouterDriver } from './react-router.driver.js';

describe('createRouterOptions', () => {
  let driver: ReactRouterDriver;

  beforeEach(() => {
    driver = new ReactRouterDriver();
  });

  it('should start the memory router at the inner url when the host is inside the app', () => {
    driver.given.hostUrl('/products?tab=open');

    expect(driver.get.routerOptions()).toEqual({
      initialEntries: ['/products?tab=open'],
    });
  });
});

describe('connectRouter', () => {
  let driver: ReactRouterDriver;

  beforeEach(() => {
    driver = new ReactRouterDriver();
  });

  describe('when the router is connected to an app at an inner url', () => {
    beforeEach(() => {
      driver.given.hostUrl('/products?tab=open').when.connected();
    });

    it('should navigate the host to the scoped url when the router pushes', () => {
      driver.when.routerNavigated('/details/42');

      expect(driver.get.hostUrl()).toBe(`${driver.get.hostPath()}/details/42`);
    });

    it('should replace the host url when the router replaces', () => {
      driver.when.routerNavigated('/details/42', { replace: true });

      expect(driver.get.hostReplaceMock()).toHaveBeenCalledWith(
        `${driver.get.hostPath()}/details/42`,
        undefined,
      );
    });

    it('should leave the host untouched when the router moves to the url the host already shows', () => {
      driver.when.routerNavigated('/products?tab=open');

      expect(driver.get.hostNavigateMock()).not.toHaveBeenCalled();
    });

    it('should move the router to the inner url when the host navigates', async () => {
      await driver.when.hostNavigated('/settings?mode=compact');

      expect(driver.get.routerLocation()).toEqual({
        pathname: '/settings',
        search: '?mode=compact',
        hash: '',
      });
    });

    it('should leave the router where it is when the host navigates after disconnecting', async () => {
      driver.when.disconnected();
      await driver.when.hostNavigated('/settings');

      expect(driver.get.routerLocation().pathname).toBe('/products');
    });
  });
});
