import { DevelopmentSessionBackgroundDriver } from './development-session-background.driver';

const SESSION = { schemaVersion: '1', hostId: 'shop', overrides: [] };

describe('loadDevelopmentSession', () => {
  let driver: DevelopmentSessionBackgroundDriver;

  beforeEach(() => {
    driver = new DevelopmentSessionBackgroundDriver();
  });

  it('should request the session from the default control port when none is given', async () => {
    await driver.when.sessionLoaded();

    expect(driver.get.requestedUrl()).toBe(
      'http://localhost:4400/atlas.dev-session.json?hostId=shop&previewUrl=http%3A%2F%2Flocalhost%3A4300%2Fdashboard',
    );
  });

  it('should request the session from the given control port when one is given', async () => {
    await driver.given.request({ controlPort: 4512 }).when.sessionLoaded();

    expect(driver.get.requestedUrl()).toContain('http://localhost:4512/');
  });

  it('should return the session when it matches the host', async () => {
    await driver.given.sessionResponse(SESSION).when.sessionLoaded();

    expect(driver.get.result()).toBe(SESSION);
  });

  it('should fail when the session belongs to another host', async () => {
    await driver.given
      .sessionResponse({ ...SESSION, hostId: 'other' })
      .when.sessionLoaded();

    expect(driver.get.errorMessage()).toBe(
      'Atlas development session is invalid.',
    );
  });

  it('should fail when the session has no overrides list', async () => {
    await driver.given
      .sessionResponse({ schemaVersion: '1', hostId: 'shop' })
      .when.sessionLoaded();

    expect(driver.get.errorMessage()).toBe(
      'Atlas development session is invalid.',
    );
  });

  it.each(['ftp://localhost/app', 'http://user:pw@localhost/app'])(
    'should fail when the preview url is %s',
    async (previewUrl) => {
      await driver.given.request({ previewUrl }).when.sessionLoaded();

      expect(driver.get.errorMessage()).toBe('Atlas preview URL is invalid.');
    },
  );

  it.each([0, 70000, 1.5])(
    'should fail when the control port is %s',
    async (controlPort) => {
      await driver.given.request({ controlPort }).when.sessionLoaded();

      expect(driver.get.errorMessage()).toBe(
        'Atlas development control port is invalid.',
      );
    },
  );
});
