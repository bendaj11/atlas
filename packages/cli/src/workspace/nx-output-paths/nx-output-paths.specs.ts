import { faker } from '@faker-js/faker';
import { NxOutputPathsDriver } from './nx-output-paths.driver.js';

describe('nxOutputPaths', () => {
  let driver: NxOutputPathsDriver;

  beforeEach(() => {
    driver = new NxOutputPathsDriver();
  });

  it('should return no paths when project has no build target', () => {
    driver.given.project({ name: faker.word.noun(), targets: {} });

    expect(driver.get.outputPaths()).toStrictEqual([]);
  });

  it('should resolve a string outputPath against the workspace root when build declares one', () => {
    driver.given.project({
      targets: { build: { options: { outputPath: 'dist/apps/orders' } } },
    });

    expect(driver.get.outputPaths()).toStrictEqual(['/repo/dist/apps/orders']);
  });

  it('should list browser then base when outputPath is an object with browser', () => {
    driver.given.project({
      targets: {
        build: {
          options: { outputPath: { base: 'dist/orders', browser: 'browser' } },
        },
      },
    });

    expect(driver.get.outputPaths()).toStrictEqual([
      '/repo/dist/orders/browser',
      '/repo/dist/orders',
    ]);
  });

  it('should order the default configuration first when several configurations exist', () => {
    driver.given.project({
      targets: {
        build: {
          defaultConfiguration: 'production',
          configurations: {
            development: { outputPath: 'dist/dev' },
            production: { outputPath: 'dist/prod' },
          },
        },
      },
    });

    expect(driver.get.outputPaths()).toStrictEqual([
      '/repo/dist/prod',
      '/repo/dist/dev',
    ]);
  });

  it('should interpolate declared outputs when build lists them', () => {
    driver.given.projectRoot('apps/orders').given.project({
      name: 'orders',
      targets: {
        build: {
          outputs: [
            '{workspaceRoot}/custom/{projectName}',
            '{projectRoot}/public',
            '{options.outputPath}',
          ],
        },
      },
    });

    expect(driver.get.outputPaths()).toStrictEqual([
      '/repo/custom/orders',
      '/repo/apps/orders/public',
    ]);
  });

  it('should follow the delegated target when build uses the native-federation executor', () => {
    driver.given.project({
      name: 'orders',
      targets: {
        build: {
          executor: '@angular-architects/native-federation:build',
          options: { target: 'orders:esbuild:production' },
        },
        esbuild: {
          options: {
            outputPath: { base: 'apps/orders/dist', browser: 'browser' },
          },
        },
      },
    });

    expect(driver.get.outputPaths()).toStrictEqual([
      '/repo/apps/orders/dist/browser',
      '/repo/apps/orders/dist',
    ]);
  });

  it('should ignore the delegated target when it names another project', () => {
    driver.given.project({
      name: 'orders',
      targets: {
        build: {
          executor: '@angular-architects/native-federation:build',
          options: { target: 'other:esbuild', outputPath: 'dist/orders' },
        },
        esbuild: { options: { outputPath: 'dist/other' } },
      },
    });

    expect(driver.get.outputPaths()).toStrictEqual(['/repo/dist/orders']);
  });
});
