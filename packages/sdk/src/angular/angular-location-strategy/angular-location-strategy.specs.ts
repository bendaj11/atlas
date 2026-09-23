import { AngularLocationStrategyDriver } from './angular-location-strategy.driver.js';

describe('createLocationStrategy', () => {
  let driver: AngularLocationStrategyDriver;

  beforeEach(() => {
    driver = new AngularLocationStrategyDriver();
  });

  describe('when created inside an app at /details/7?tab=history#top', () => {
    beforeEach(() => {
      driver.given.innerUrl('/details/7?tab=history#top').when.created();
    });

    it('should return the inner url with hash when path is read', () => {
      expect(driver.get.strategy().path()).toBe('/details/7?tab=history#top');
    });

    it('should return the inner url without hash when path is read without hash', () => {
      expect(driver.get.strategy().path(false)).toBe('/details/7?tab=history');
    });

    it('should scope the url to the host path when prepareExternalUrl is called', () => {
      expect(driver.get.strategy().prepareExternalUrl('/settings')).toBe(
        `${driver.get.hostPath()}/settings`,
      );
    });

    it('should return the root when getBaseHref is called', () => {
      expect(driver.get.strategy().getBaseHref()).toBe('/');
    });

    it('should navigate the host when the router pushes state', () => {
      driver.when.routerPushed('/details/8', '?tab=summary');

      expect(driver.get.hostUrl()).toBe(
        `${driver.get.hostPath()}/details/8?tab=summary`,
      );
    });

    it('should not notify popstate when the router pushes state', () => {
      driver.when.routerPushed('/details/8', '?tab=summary');

      expect(driver.get.popStateMock()).not.toHaveBeenCalled();
    });

    it('should navigate the host when the router replaces state', () => {
      driver.when.routerReplaced('details/9', '');

      expect(driver.get.hostUrl()).toBe(`${driver.get.hostPath()}/details/9`);
    });

    it('should return no state when getState is called', () => {
      expect(driver.get.strategy().getState()).toBeUndefined();
    });

    it('should move the host forward when the router goes forward', () => {
      driver.when.routerWentForward();

      expect(driver.get.hostGoMock()).toHaveBeenCalledWith(1);
    });

    it('should move the host back when the router goes back', () => {
      driver.when.routerWentBack();

      expect(driver.get.hostBackMock()).toHaveBeenCalled();
    });

    it('should move the host by the delta when the router goes through history', () => {
      driver.when.routerWentThroughHistory(-2);

      expect(driver.get.hostGoMock()).toHaveBeenCalledWith(-2);
    });

    it('should notify popstate when the host navigates', () => {
      driver.when.hostNavigated('/settings');

      expect(driver.get.popStateMock()).toHaveBeenCalledWith({
        type: 'popstate',
        state: undefined,
      });
    });

    it('should not notify popstate when the host navigates after destroy', () => {
      driver.when.destroyed();
      driver.when.hostNavigated('/settings');

      expect(driver.get.popStateMock()).not.toHaveBeenCalled();
    });
  });
});
