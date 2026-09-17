import { faker } from '@faker-js/faker';
import { aManifestDescriptor, aRegistryArtifact } from '@atlas/testkit';
import { ArtifactResolutionDriver } from './artifact-resolution.driver.js';

describe('artifact resolution', () => {
  let driver: ArtifactResolutionDriver;

  beforeEach(() => {
    driver = new ArtifactResolutionDriver();
  });

  describe('resolveRegistryArtifact', () => {
    it('should reject when identifier matches no artifact', () => {
      expect(() => driver.get.artifact(faker.string.uuid())).toThrow(
        /is not registered/,
      );
    });

    it('should resolve app by id when id is registered as app', () => {
      const app = aRegistryArtifact();
      driver.given.app(app);

      expect(driver.get.artifact(app.id)).toStrictEqual({
        kind: 'app',
        artifact: app,
      });
    });

    it('should resolve host by id when id is registered as host', () => {
      const host = aRegistryArtifact();
      driver.given.host(host);

      expect(driver.get.artifact(host.id)).toStrictEqual({
        kind: 'host',
        artifact: host,
      });
    });

    it('should resolve artifact by package name when package name is unique', () => {
      const app = aRegistryArtifact();
      driver.given.app(app);

      expect(driver.get.artifact(app.packageName!).artifact).toBe(app);
    });

    it('should resolve artifact by name when name is unique', () => {
      const app = aRegistryArtifact();
      driver.given.app(app);

      expect(driver.get.artifact(app.name).artifact).toBe(app);
    });

    it('should reject when name matches several artifacts', () => {
      const name = faker.commerce.productName();
      const first = aRegistryArtifact({ name });
      const second = aRegistryArtifact({ name });
      driver.given.app(first).given.host(second);

      expect(() => driver.get.artifact(name)).toThrow(
        `is ambiguous. Use one of these stable IDs: ${first.id}, ${second.id}.`,
      );
    });
  });

  describe('resolveRelease', () => {
    it('should resolve exact release when selector is a registered version', () => {
      const version = faker.system.semver();
      const descriptor = aManifestDescriptor();
      const app = aRegistryArtifact({ releases: { [version]: descriptor } });
      driver.given.app(app);

      expect(driver.get.release(app.id, version)).toStrictEqual({
        kind: 'app',
        artifact: app,
        version,
        manifest: descriptor,
      });
    });

    it('should resolve latest release when selector is latest', () => {
      const version = faker.system.semver();
      const descriptor = aManifestDescriptor();
      const app = aRegistryArtifact({
        latest: version,
        releases: { [version]: descriptor },
      });
      driver.given.app(app);

      expect(driver.get.release(app.id, 'latest')).toStrictEqual({
        kind: 'app',
        artifact: app,
        version,
        manifest: descriptor,
      });
    });

    it('should reject latest when artifact has no latest release', () => {
      const app = aRegistryArtifact();
      driver.given.app(app);

      expect(() => driver.get.release(app.id, 'latest')).toThrow(
        /has no latest release/,
      );
    });

    it('should reject when selector matches no release', () => {
      const app = aRegistryArtifact();
      driver.given.app(app);

      expect(() => driver.get.release(app.id, faker.system.semver())).toThrow(
        /is neither a release nor latest/,
      );
    });
  });
});
