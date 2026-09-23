/** @jest-environment jsdom */

import { faker } from '@faker-js/faker';
import { BrowserNavigationDriver } from './browser-navigation.driver.js';

describe('createBrowserNavigation', () => {
  let driver: BrowserNavigationDriver;

  beforeEach(() => {
    driver = new BrowserNavigationDriver();
  });

  it('should push history state when navigating', () => {
    const to = `/${faker.lorem.slug()}`;
    const state = { id: faker.string.uuid() };

    driver.when.navigated(to, { state });

    expect(driver.get.pushStateMock()).toHaveBeenCalledWith(state, '', to);
  });

  it('should replace history state when navigating with replace', () => {
    const to = `/${faker.lorem.slug()}`;

    driver.when.navigated(to, { replace: true });

    expect(driver.get.replaceStateMock()).toHaveBeenCalledWith(null, '', to);
  });

  it('should replace history state when replace is called', () => {
    const to = `/${faker.lorem.slug()}`;

    driver.when.replaced(to);

    expect(driver.get.replaceStateMock()).toHaveBeenCalledWith(null, '', to);
  });

  it('should call history go with the delta when go is called', () => {
    const delta = faker.number.int({ min: -5, max: 5 });

    driver.when.historyMoved(delta);

    expect(driver.get.goMock()).toHaveBeenCalledWith(delta);
  });

  it('should keep the given state when replace is called with state', () => {
    const state = { id: faker.string.uuid() };

    driver.when.replaced(`/${faker.lorem.slug()}`, { state });

    expect(driver.get.replaceStateMock()).toHaveBeenCalledWith(
      state,
      '',
      expect.any(String),
    );
  });

  it('should call history back when back is called', () => {
    driver.when.wentBack();

    expect(driver.get.backMock()).toHaveBeenCalledTimes(1);
  });

  it('should not detach the popstate listener when disposed without subscribers', () => {
    driver.when.disposed();

    expect(driver.get.removeEventListenerMock()).not.toHaveBeenCalled();
  });

  it('should read the global window when created without a window', () => {
    driver.when.createdFromGlobalWindow();

    expect(driver.get.globalWindowNavigation()?.getCurrentLocation()).toEqual({
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
    });
  });

  it('should resolve the href against the window location when createHref is called', () => {
    expect(driver.get.navigation().createHref('/orders')).toBe(
      `${driver.get.origin()}/orders`,
    );
  });

  describe('when subscribed', () => {
    beforeEach(() => {
      driver.when.subscribed();
    });

    it('should call the listener with the current location when subscribing', () => {
      expect(driver.get.listenerMock()).toHaveBeenCalledWith({
        pathname: '/',
        search: '',
        hash: '',
      });
    });

    it('should call the listener with the new location when the browser moves', () => {
      driver.when.browserMovedTo('/returned');

      expect(driver.get.listenerMock()).toHaveBeenLastCalledWith({
        pathname: '/returned',
        search: '',
        hash: '',
      });
    });

    it('should call the listener with the new location when navigating', () => {
      driver.when.navigated('/orders');

      expect(driver.get.listenerMock()).toHaveBeenCalledTimes(2);
    });

    it('should attach the popstate listener once when a second subscriber arrives', () => {
      driver.when.subscribed();

      expect(driver.get.addEventListenerMock()).toHaveBeenCalledTimes(1);
    });

    it('should detach the popstate listener when the last subscriber leaves', () => {
      driver.when.unsubscribed();

      expect(driver.get.removeEventListenerMock()).toHaveBeenCalledWith(
        'popstate',
        driver.get.addEventListenerMock().mock.calls[0]?.[1],
      );
    });

    it('should attach popstate again when a new subscriber arrives after the last one left', () => {
      driver.when.unsubscribed();
      driver.when.subscribed();

      expect(driver.get.addEventListenerMock()).toHaveBeenCalledTimes(2);
    });

    it('should not call the listener when the browser moves after dispose', () => {
      driver.when.disposed();
      driver.when.browserMovedTo('/after-dispose');

      expect(driver.get.listenerMock()).toHaveBeenCalledTimes(1);
    });
  });
});
