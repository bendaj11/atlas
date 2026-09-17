import { AngularGenerationDriver } from './angular.driver.js';
import { ensureAngularNativeFederationTargets } from './angular-targets.js';

describe('ensureAngularNativeFederationTargets', () => {
  it('should configure an SSE endpoint when an Angular host serves locally', () => {
    const targets: Record<string, unknown> = {
      build: { builder: '@angular-devkit/build-angular:application' },
      serve: { builder: '@angular-devkit/build-angular:dev-server' },
    };

    ensureAngularNativeFederationTargets({
      targets,
      projectName: 'catalog',
      type: 'host',
      runnerKey: 'builder',
    });

    expect(targets.serve).toMatchObject({
      options: {
        buildNotifications: {
          enable: true,
          endpoint:
            '/@angular-architects/native-federation:build-notifications',
        },
      },
    });
  });

  it('should configure an SSE endpoint when an Angular app serves locally', () => {
    const targets: Record<string, unknown> = {
      build: { builder: '@angular-devkit/build-angular:application' },
      serve: { builder: '@angular-devkit/build-angular:dev-server' },
    };

    ensureAngularNativeFederationTargets({
      targets,
      projectName: 'catalog',
      type: 'app',
      runnerKey: 'builder',
    });

    expect(targets.serve).toMatchObject({
      options: {
        buildNotifications: {
          enable: true,
          endpoint:
            '/@angular-architects/native-federation:build-notifications',
        },
      },
    });
  });

  it('should configure local development when existing Angular project uses Nx', async () => {
    const driver = new AngularGenerationDriver();
    await driver.given.nxProject();

    await driver.when.enableBuildNotifications();

    await expect(driver.get.nxTargets()).resolves.toMatchObject({
      serve: {
        options: {
          buildNotifications: {
            enable: true,
            endpoint:
              '/@angular-architects/native-federation:build-notifications',
          },
        },
      },
    });
  });
});
