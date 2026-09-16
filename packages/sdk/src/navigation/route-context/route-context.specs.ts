import { faker } from '@faker-js/faker';
import { RouteContextDriver } from './route-context.driver.js';

describe('createRouteContext', () => {
  let driver: RouteContextDriver;

  beforeEach(() => {
    driver = new RouteContextDriver();
  });

  describe('when the app path is /catalog and the host is at an inner order url', () => {
    beforeEach(() => {
      driver.given
        .path('/catalog')
        .given.hostUrl('/catalog/orders/42?tab=open&tag=a&tag=b#top')
        .when.created();
    });

    it('should return the inner pathname, query and hash when getCurrent is called', () => {
      expect(driver.get.route().getCurrent()).toEqual({
        pathname: '/orders/42',
        query: { tab: 'open', tag: ['a', 'b'] },
        hash: '#top',
      });
    });

    it('should return route params when match is called with a matching pattern', () => {
      expect(driver.get.route().match('orders/:id')).toEqual({ id: '42' });
    });

    it('should return undefined when match is called with a different pattern', () => {
      expect(driver.get.route().match('invoices/:id')).toBeUndefined();
    });

    it('should call the setTabTitle option when setTabTitle is called', () => {
      const title = faker.lorem.words();

      driver.when.tabTitleSet(title);

      expect(driver.get.setTabTitleMock()).toHaveBeenCalledWith(title);
    });

    it('should call the listener with the new inner location when the host navigates after subscribing', () => {
      driver.when.subscribed();
      driver.when.hostNavigated('/catalog/settings');

      expect(driver.get.listenerMock()).toHaveBeenLastCalledWith({
        pathname: '/settings',
        query: {},
        hash: '',
      });
    });
  });
});
