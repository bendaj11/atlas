import { faker } from '@faker-js/faker';
import { ArtifactRootDriver } from './artifact-root.driver.js';

describe('artifact-root', () => {
  let driver: ArtifactRootDriver;

  beforeEach(async () => {
    driver = new ArtifactRootDriver();

    await driver.given.workspace();
  });

  describe('findArtifactRootIfPresent', () => {
    it('should prefer a declared output path when it holds the entry', async () => {
      await driver.given.file('custom/out/remoteEntry.json', '{}');
      await driver.given.file('apps/orders/dist/remoteEntry.json', '{}');
      driver.given.project({ outputPaths: [driver.get.path('custom/out')] });

      expect(await driver.get.artifactRootIfPresent()).toBe('custom/out');
    });

    it('should find dist/apps/<project id> under the workspace when it holds the entry', async () => {
      driver.given.project({ id: 'orders' });
      await driver.given.file('dist/apps/orders/remoteEntry.json', '{}');

      expect(await driver.get.artifactRootIfPresent()).toBe('dist/apps/orders');
    });

    it('should find dist/apps/<config id> under the workspace when it holds the entry', async () => {
      await driver.given.file(
        `dist/apps/${driver.get.configId()}/remoteEntry.json`,
        '{}',
      );

      expect(await driver.get.artifactRootIfPresent()).toBe(
        `dist/apps/${driver.get.configId()}`,
      );
    });

    it('should find the project dist directory when it holds the entry', async () => {
      await driver.given.file('apps/orders/dist/remoteEntry.json', '{}');

      expect(await driver.get.artifactRootIfPresent()).toBe('apps/orders/dist');
    });

    it('should look inside browser when framework is angular', async () => {
      driver.given.framework('angular');
      await driver.given.file(
        'apps/orders/dist/browser/remoteEntry.json',
        '{}',
      );

      expect(await driver.get.artifactRootIfPresent()).toBe(
        'apps/orders/dist/browser',
      );
    });

    it('should honor a custom entry path when configured', async () => {
      driver.given.entryPath('federation.json');
      await driver.given.file('apps/orders/dist/federation.json', '{}');

      expect(await driver.get.artifactRootIfPresent()).toBe('apps/orders/dist');
    });

    it('should return undefined when no candidate holds the entry', async () => {
      await driver.given.file('apps/orders/dist/index.html', '');

      expect(await driver.get.artifactRootIfPresent()).toBeUndefined();
    });
  });

  describe('findArtifactRoot', () => {
    it('should reject with artifacts-missing code when no candidate holds the entry', async () => {
      await expect(driver.get.artifactRoot()).rejects.toMatchObject({
        code: 'ATLAS_ARTIFACTS_MISSING',
      });
    });
  });

  describe('listArtifactFiles', () => {
    it('should list nested files sorted when the directory has subdirectories', async () => {
      await driver.given.file('out/b.js');
      await driver.given.file('out/assets/a.svg');
      await driver.given.file('out/a.js');

      expect(await driver.get.files('out')).toStrictEqual([
        'a.js',
        'assets/a.svg',
        'b.js',
      ]);
    });
  });

  describe('hashArtifactDirectory', () => {
    it('should return a stable hex digest when contents are unchanged', async () => {
      await driver.given.file('out/a.js', faker.lorem.sentence());

      expect(await driver.get.hash('out')).toBe(await driver.get.hash('out'));
    });

    it('should change the digest when a file changes', async () => {
      await driver.given.file('out/a.js', 'one');
      const before = await driver.get.hash('out');
      await driver.given.file('out/a.js', 'two');

      expect(await driver.get.hash('out')).not.toBe(before);
    });
  });
});
