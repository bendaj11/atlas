import { faker } from '@faker-js/faker';
import { InjectAtlasSdkDriver } from './inject-atlas-sdk.driver.js';

describe('injectAtlasSdk', () => {
  let driver: InjectAtlasSdkDriver;

  beforeEach(() => {
    driver = new InjectAtlasSdkDriver();
  });

  describe('when injected inside an app context', () => {
    beforeEach(() => {
      driver.when.injected();
    });

    it('should expose custom SDK functions when injected', () => {
      driver.get.atlas().greet();

      expect(driver.get.greetMock()).toHaveBeenCalledTimes(1);
    });

    it('should expose host data as a signal that follows host updates when the host renames the user', () => {
      const userName = faker.person.firstName();

      driver.when.userRenamed(userName);

      expect(driver.get.atlas().hostData().userName).toBe(userName);
    });

    it('should stop following host updates when the injector is destroyed', () => {
      const before = driver.get.atlas().hostData().userName;

      driver.when.injectorDestroyed();
      driver.when.userRenamed(faker.person.firstName());

      expect(driver.get.atlas().hostData().userName).toBe(before);
    });

    it('should resolve asset urls inside the app artifact when injected with an app context', () => {
      const artifactDirectory = new URL(
        '.',
        driver.get.context()?.manifest.remoteEntryUrl,
      ).href;

      expect(driver.get.atlas().assetUrl('logo.svg')).toBe(
        `${artifactDirectory}logo.svg`,
      );
    });
  });

  it('should throw ATLAS_APP_CONTEXT_MISSING when assetUrl is called after injecting without an app context', () => {
    driver.given.appContext(undefined).when.injected();

    expect(() => driver.get.atlas().assetUrl('logo.svg')).toThrow(
      expect.objectContaining({ code: 'ATLAS_APP_CONTEXT_MISSING' }),
    );
  });
});
