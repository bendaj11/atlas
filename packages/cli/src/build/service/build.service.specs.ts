import { faker } from '@faker-js/faker';
import { aHostConfig, anAppConfig } from '@atlas/testkit';
import { BuildServiceDriver } from './build.service.driver.js';

describe('AtlasBuildService', () => {
  let driver: BuildServiceDriver;

  beforeEach(async () => {
    driver = new BuildServiceDriver();

    await driver.given.project();
  });

  afterEach(() => {
    driver.get.restoreEnvironment();
  });

  describe('publication', () => {
    describe('when a react app has a built artifact and --version', () => {
      const id = faker.string.uuid();
      const version = faker.system.semver();

      beforeEach(async () => {
        driver.given.config(anAppConfig({ id, framework: 'react' }));
        await driver.given.artifactFile('remoteEntry.json', '{}');
        await driver.given.artifactFile('main.js.map', faker.lorem.sentence());
        driver.given.flags([`--version=${version}`]);

        await driver.when.publicationBuilt();
      });

      it('should classify the result as an app when built', () => {
        expect(driver.get.result().artifact).toBe('app');
      });

      it('should inventory every artifact file including source maps when built', () => {
        expect(driver.get.result().files).toStrictEqual([
          'main.js.map',
          'remoteEntry.json',
        ]);
      });

      it('should describe the release in the manifest when built', () => {
        expect(driver.get.result().manifest).toMatchObject({
          kind: 'app-artifact',
          id,
          release: { version },
          entryPath: 'remoteEntry.json',
        });
      });

      it('should use the artifact directory as the source when built', () => {
        expect(driver.get.result().sourceDirectory).toBe(
          driver.get.artifactRoot(),
        );
      });
    });

    it('should build a host artifact manifest when the config is a host', async () => {
      driver.given.config(aHostConfig({ framework: 'react' }));
      await driver.given.artifactFile('remoteEntry.json', '{}');
      driver.given.flags([`--version=${faker.system.semver()}`]);

      await driver.when.publicationBuilt();

      expect(driver.get.result().manifest).toMatchObject({
        kind: 'host-artifact',
        exposes: { entry: './host' },
      });
    });

    it('should reject when the release version is not a safe segment', async () => {
      driver.given.config(anAppConfig({ framework: 'react' }));
      await driver.given.artifactFile('remoteEntry.json', '{}');
      driver.given.flags(['--version=release candidate']);

      await expect(driver.when.publicationBuilt()).rejects.toThrow(
        /release version/i,
      );
    });

    it('should reject with artifacts-missing code when no build output exists', async () => {
      driver.given.config(anAppConfig({ framework: 'react' }));
      driver.given.flags([`--version=${faker.system.semver()}`]);

      await expect(driver.when.publicationBuilt()).rejects.toMatchObject({
        code: 'ATLAS_ARTIFACTS_MISSING',
      });
    });
  });

  describe('buildManifest', () => {
    describe('when a react app has a built artifact and a registry URL', () => {
      const id = faker.string.uuid();
      const registryUrl = faker.internet.url({ appendSlash: false });

      beforeEach(async () => {
        driver.given.config(anAppConfig({ id, framework: 'react' }));
        await driver.given.artifactFile('remoteEntry.json', '{}');
        driver.given.flags([`--registry-url=${registryUrl}`]);
        driver.given.environment('ATLAS_CREATED_AT', undefined);
      });

      it('should place the remote entry under the registry apps path when built for production', async () => {
        driver.given.projectField({ version: '2.0.0' });

        await driver.when.manifestBuilt('production');

        expect(driver.get.manifest().remoteEntryUrl).toMatch(
          new RegExp(
            `^${registryUrl}/apps/${id}/2\\.0\\.0/[0-9a-f]{12}/remoteEntry\\.json$`,
          ),
        );
      });

      it('should attach entry integrity when built for production', async () => {
        await driver.when.manifestBuilt('production');

        expect(driver.get.manifest().integrity).toMatch(/^sha256-/);
      });

      it('should change the build id when an artifact file changes', async () => {
        await driver.when.manifestBuilt('local');
        const first = driver.get.manifest().buildId;
        await driver.given.artifactFile(
          'main.js.map',
          faker.lorem.paragraphs(),
        );

        await driver.when.manifestBuilt('local');

        expect(driver.get.manifest().buildId).not.toBe(first);
      });

      it('should return an identical manifest when ATLAS_CREATED_AT pins the timestamp', async () => {
        driver.given.environment(
          'ATLAS_CREATED_AT',
          faker.date.past().toISOString(),
        );
        await driver.when.manifestBuilt('production');
        const first = driver.get.manifest();

        await driver.when.manifestBuilt('production');

        expect(driver.get.manifest()).toStrictEqual(first);
      });
    });

    it('should serve the remote entry from the local base URL when built for local', async () => {
      const baseUrl = faker.internet.url({ appendSlash: false });
      driver.given.config(anAppConfig({ framework: 'react' }));

      await driver.when.manifestBuilt('local', { skipCompile: true, baseUrl });

      expect(driver.get.manifest()).toMatchObject({
        channel: 'local',
        buildId: 'local',
        remoteEntryUrl: `${baseUrl}/remoteEntry.json`,
      });
    });

    it('should reject with registry-url-missing code when no registry URL is configured for production', async () => {
      driver.given.config(anAppConfig({ framework: 'react' }));
      await driver.given.artifactFile('remoteEntry.json', '{}');
      driver.given.environment('ATLAS_REGISTRY_URL', undefined);

      await expect(
        driver.when.manifestBuilt('production'),
      ).rejects.toMatchObject({
        code: 'ATLAS_REGISTRY_URL_MISSING',
      });
    });

    it('should reject when the config is a host', async () => {
      driver.given.config(aHostConfig({ framework: 'react' }));

      await expect(driver.when.manifestBuilt('local')).rejects.toThrow(
        /expects an app config/,
      );
    });
  });

  describe('buildLocalHostManifest', () => {
    describe('when the config is an angular host', () => {
      const id = faker.string.uuid();
      const baseUrl = faker.internet.url({ appendSlash: false });

      beforeEach(async () => {
        driver.given.config(aHostConfig({ id, framework: 'angular' }));

        await driver.when.localHostManifestBuilt(baseUrl);
      });

      it('should point at the local remote entry when built', () => {
        expect(driver.get.hostManifest()).toMatchObject({
          kind: 'host',
          id,
          channel: 'local',
          buildId: 'local',
          remoteEntryUrl: `${baseUrl}/remoteEntry.json`,
        });
      });

      it('should include the Angular global stylesheet when built', () => {
        expect(driver.get.hostManifest().styles).toStrictEqual([
          { href: `${baseUrl}/styles.css` },
        ]);
      });

      it('should write the manifest under .atlas when built', async () => {
        expect(await driver.get.writtenHostManifest()).toStrictEqual(
          driver.get.hostManifest(),
        );
      });
    });

    it('should reject when the config is an app', async () => {
      driver.given.config(anAppConfig({ framework: 'react' }));

      await expect(
        driver.when.localHostManifestBuilt(faker.internet.url()),
      ).rejects.toThrow(/expected .* to be a host/);
    });
  });
});
