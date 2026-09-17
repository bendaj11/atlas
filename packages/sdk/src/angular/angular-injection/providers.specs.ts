import { ProvidersDriver } from './providers.driver.js';

describe('provideAtlasAppContext', () => {
  let driver: ProvidersDriver;

  beforeEach(() => {
    driver = new ProvidersDriver();
  });

  describe('when the app context is provided', () => {
    beforeEach(() => {
      driver.when.appContextProvided();
    });

    it('should provide the manifest id as APP_ID when the app context is provided', () => {
      expect(driver.get.appId()).toBe(driver.get.context().manifest.id);
    });

    it('should return the provided context when injectAtlasAppContext is called', () => {
      expect(driver.get.injectedAppContext()).toBe(driver.get.context());
    });

    it('should call waitUntilReady when injectAppLoaded is called', () => {
      driver.when.appLoadedInjected();

      expect(driver.get.waitUntilReadyMock()).toHaveBeenCalledTimes(1);
    });
  });
});
