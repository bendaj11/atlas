import { AngularWorkspaceGeneratorDriver } from './angular-workspace-generator.driver.js';

describe('Angular workspace dependency resolution', () => {
  let driver: AngularWorkspaceGeneratorDriver;

  beforeEach(() => {
    driver = new AngularWorkspaceGeneratorDriver();
  });

  it.each(['host', 'app'] as const)(
    'should resolve dependency real paths when generating an Angular %s',
    (kind) => {
      driver.given.project(kind);

      expect(driver.get.workspace()).toMatchObject({
        projects: {
          example: {
            architect: {
              esbuild: { options: { preserveSymlinks: false } },
            },
          },
        },
      });
    },
  );
});
