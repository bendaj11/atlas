import { faker } from '@faker-js/faker';
import { DiscoveryDriver } from './discovery.driver.js';

describe('discovery', () => {
  let driver: DiscoveryDriver;

  beforeEach(async () => {
    driver = new DiscoveryDriver();

    await driver.given.workspace();
  });

  describe('findAtlasProject', () => {
    describe('when a package project exists under apps', () => {
      const name = faker.word.noun().toLowerCase();
      const version = faker.system.semver();
      const packageName = `@scope/${name}`;

      beforeEach(async () => {
        await driver.given.project(`apps/${name}`, {
          packageJson: { name: packageName, version },
        });
      });

      it('should resolve by scoped package name when name is the package name', async () => {
        expect(await driver.get.project(packageName)).toStrictEqual({
          id: packageName,
          root: `apps/${name}`,
          packageName,
          version,
          outputPaths: [],
        });
      });

      it('should resolve by unscoped package name when name is the last segment', async () => {
        expect((await driver.get.project(name)).root).toBe(`apps/${name}`);
      });

      it('should resolve by directory when name is a workspace-relative path', async () => {
        expect((await driver.get.project(`apps/${name}`)).root).toBe(
          `apps/${name}`,
        );
      });

      it('should resolve the current directory when name is a dot', async () => {
        expect((await driver.get.project('.', `apps/${name}`)).root).toBe(
          `apps/${name}`,
        );
      });

      it('should not match the current directory when name is another project', async () => {
        await expect(
          driver.get.project(faker.string.alpha(8), `apps/${name}`),
        ).rejects.toMatchObject({ code: 'ATLAS_PROJECT_NOT_FOUND' });
      });
    });

    it('should take id and version from project.json when package.json is absent', async () => {
      const name = faker.word.noun().toLowerCase();
      await driver.given.project(`apps/${name}`, {
        projectJson: { name },
      });

      expect(await driver.get.project(name)).toMatchObject({
        id: name,
        packageName: name,
        version: '0.0.0',
      });
    });

    it('should inherit the workspace version when the project declares none', async () => {
      const name = faker.word.noun().toLowerCase();
      const version = faker.system.semver();
      await driver.given.workspace({ version });
      await driver.given.project(`apps/${name}`, {
        packageJson: { name },
        projectJson: { name },
      });

      expect((await driver.get.project(name)).version).toBe(version);
    });

    it('should include Nx output paths when project.json declares a build target', async () => {
      const name = faker.word.noun().toLowerCase();
      await driver.given.project(`apps/${name}`, {
        packageJson: { name, version: faker.system.semver() },
        projectJson: {
          name,
          targets: { build: { options: { outputPath: `dist/apps/${name}` } } },
        },
      });

      expect((await driver.get.project(name)).outputPaths).toStrictEqual([
        `dist/apps/${name}`,
      ]);
    });

    it('should reject with the config path when atlas.config.ts is missing', async () => {
      const name = faker.word.noun().toLowerCase();
      await driver.given.project(`apps/${name}`, {
        packageJson: { name, version: faker.system.semver() },
        atlasConfig: false,
      });

      await expect(driver.get.project(name)).rejects.toThrow(
        `Atlas project "${name}" is missing required configuration file "apps/${name}/atlas.config.ts".`,
      );
    });

    it('should reject as ambiguous when two projects share the name', async () => {
      const name = faker.word.noun().toLowerCase();
      await driver.given.project(`apps/${name}`, {
        packageJson: { name: `@one/${name}`, version: faker.system.semver() },
      });
      await driver.given.project(`packages/${name}`, {
        packageJson: { name: `@two/${name}`, version: faker.system.semver() },
      });

      await expect(driver.get.project(name)).rejects.toMatchObject({
        code: 'ATLAS_PROJECT_AMBIGUOUS',
      });
    });

    it('should reject as not found when no project matches', async () => {
      await expect(
        driver.get.project(faker.word.noun().toLowerCase()),
      ).rejects.toMatchObject({ code: 'ATLAS_PROJECT_NOT_FOUND' });
    });
  });

  describe('listAtlasProjects', () => {
    it('should list configured projects sorted by root when several exist', async () => {
      await driver.given.project('apps/b', {
        packageJson: { name: 'b', version: faker.system.semver() },
      });
      await driver.given.project('apps/a', {
        packageJson: { name: 'a', version: faker.system.semver() },
      });

      expect(
        (await driver.get.projects()).map(({ root }) => root),
      ).toStrictEqual(['apps/a', 'apps/b']);
    });

    it('should skip directories without atlas.config.ts when listing', async () => {
      await driver.given.project('apps/plain', {
        packageJson: { name: 'plain', version: faker.system.semver() },
        atlasConfig: false,
      });

      expect(await driver.get.projects()).toStrictEqual([]);
    });

    it('should skip node_modules when listing', async () => {
      await driver.given.project('node_modules/dep', {
        packageJson: { name: 'dep', version: faker.system.semver() },
      });

      expect(await driver.get.projects()).toStrictEqual([]);
    });
  });
});
