import { jest } from '@jest/globals';
import { aRegistryWith } from '../publication.testkit.js';
import { emptyStaticRegistry } from '../static-registry/static-registry.js';
import { RegistryIoDriver } from './registry-io.driver.js';

describe('registry-io', () => {
  let driver: RegistryIoDriver;

  beforeEach(() => {
    driver = new RegistryIoDriver();
  });

  describe('readRegistry', () => {
    it('should return undefined when registry.json is absent', async () => {
      expect(await driver.get.registry()).toBeUndefined();
    });

    it('should return the parsed registry when registry.json is valid', async () => {
      const registry = emptyStaticRegistry();
      driver.given.storedRegistry(registry);

      expect(await driver.get.registry()).toStrictEqual(registry);
    });

    it('should reject with a JSON cause when registry.json is malformed', async () => {
      driver.given.storedRegistry('{ nope');

      await expect(driver.get.registry()).rejects.toMatchObject({
        message: 'Atlas registry.json is not valid JSON.',
        cause: expect.any(SyntaxError),
      });
    });
  });

  describe('readRegistryState', () => {
    it('should include the version token when registry.json exists', async () => {
      driver.given.storedRegistry(emptyStaticRegistry());

      expect((await driver.get.state()).versionToken).toBe('v1');
    });

    it('should reject when registry.json changes between inspections', async () => {
      driver.given.storedRegistry(emptyStaticRegistry());
      driver.given.registryChangingDuringRead();

      await expect(driver.get.state()).rejects.toThrow(
        'Atlas registry.json changed while it was being read. Retry the operation.',
      );
    });
  });

  describe('writeRegistry', () => {
    it('should write canonical JSON with a trailing newline when written', async () => {
      const registry = emptyStaticRegistry();

      await driver.when.written(registry);

      expect(driver.get.storedText()).toMatch(/\n$/);
    });

    it('should create-only when no version token is given', async () => {
      driver.given.storedRegistry(emptyStaticRegistry());

      await expect(driver.when.written(emptyStaticRegistry())).rejects.toThrow(
        'Conditional publication write conflicted: registry.json',
      );
    });

    it('should replace conditionally when the version token matches', async () => {
      driver.given.storedRegistry(emptyStaticRegistry());

      await driver.when.written(emptyStaticRegistry(), 'v1');

      expect(driver.get.storedVersionToken()).toBe('v2');
    });
  });

  describe('assertExpectedRegistryRevision', () => {
    it('should pass when --expected-registry-revision matches the current revision', () => {
      const registry = emptyStaticRegistry();
      driver.given.flags([`--expected-registry-revision=${registry.revision}`]);

      expect(driver.get.expectedRevisionAssertion(registry)).not.toThrow();
    });

    it('should throw when --expected-registry-revision differs', () => {
      const registry = emptyStaticRegistry();
      driver.given.flags(['--expected-registry-revision=sha256:other']);

      expect(driver.get.expectedRevisionAssertion(registry)).toThrow(
        `Registry revision conflict: expected sha256:other, found ${registry.revision}.`,
      );
    });
  });

  describe('publicRegistryRoot', () => {
    it('should strip a trailing registry.json when the flag points at the file', () => {
      driver.given.flags([
        '--registry-url=https://cdn.example/atlas/registry.json',
      ]);

      expect(driver.get.publicRegistryRoot()).toBe('https://cdn.example/atlas');
    });

    it('should throw when no registry URL is configured', () => {
      driver.given.flags([]);

      expect(() => driver.get.publicRegistryRoot()).toThrow(
        '--registry-url or ATLAS_REGISTRY_URL is required.',
      );
    });

    it('should throw when the registry URL is plain http off loopback', () => {
      driver.given.flags(['--registry-url=http://cdn.example/atlas']);

      expect(() => driver.get.publicRegistryRoot()).toThrow(
        'Atlas public registry URL must use HTTPS outside loopback.',
      );
    });
  });

  describe('verifyPublicRegistry', () => {
    it('should delegate to config.verifyRegistry when configured', async () => {
      const registry = emptyStaticRegistry();
      const verifyRegistry = jest.fn<(registry: unknown) => void>();
      driver.given.config({ verifyRegistry });

      await driver.when.publicRegistryVerified(registry);

      expect(verifyRegistry).toHaveBeenCalledWith(registry);
    });

    it('should fetch registry.json from the public root when no verifier is configured', async () => {
      const registry = emptyStaticRegistry();
      driver.given
        .flags(['--registry-url=https://cdn.example/atlas'])
        .given.publicResponse(Response.json(registry));

      await driver.when.publicRegistryVerified(registry);

      expect(driver.get.fetchMock()).toHaveBeenCalledWith(
        new URL('https://cdn.example/atlas/registry.json'),
        { cache: 'no-store', redirect: 'manual' },
      );
    });

    it('should reject when the public registry responds with a redirect', async () => {
      driver.given
        .flags(['--registry-url=https://cdn.example/atlas'])
        .given.publicResponse(new Response(null, { status: 301 }));

      await expect(
        driver.when.publicRegistryVerified(emptyStaticRegistry()),
      ).rejects.toThrow(
        'Atlas could not verify public registry.json: HTTP 301.',
      );
    });

    it('should reject when the public revision differs from the published one', async () => {
      const published = aRegistryWith();
      driver.given
        .flags(['--registry-url=https://cdn.example/atlas'])
        .given.publicResponse(Response.json(emptyStaticRegistry()));

      await expect(
        driver.when.publicRegistryVerified(published),
      ).rejects.toThrow(
        /Public registry revision .* does not match published revision/,
      );
    });
  });
});
