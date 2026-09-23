import { AngularGenerationDriver } from './angular.driver.js';

const BUILD_NOTIFICATIONS = {
  options: {
    buildNotifications: {
      enable: true,
      endpoint: '/@angular-architects/native-federation:build-notifications',
    },
  },
};

describe('angular generation', () => {
  let driver: AngularGenerationDriver;

  beforeEach(() => {
    driver = new AngularGenerationDriver();
  });

  describe('ensureAngularNativeFederationTargets', () => {
    it.each(['host', 'app'] as const)(
      'should configure an SSE endpoint on serve when an Angular %s serves locally',
      (type) => {
        driver.when.federationTargetsEnsured(type);

        expect(driver.get.serveTarget()).toMatchObject(BUILD_NOTIFICATIONS);
      },
    );
  });

  describe('ensureAngularBuildNotifications', () => {
    it('should configure an SSE endpoint on serve when an existing Angular project uses Nx', async () => {
      await driver.given.nxProject();

      await driver.when.buildNotificationsEnabled();

      expect(await driver.get.nxServeTarget()).toMatchObject(
        BUILD_NOTIFICATIONS,
      );
    });
  });
});
