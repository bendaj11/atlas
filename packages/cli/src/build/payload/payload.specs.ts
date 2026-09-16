import { faker } from '@faker-js/faker';
import { PayloadDriver } from './payload.driver.js';

const UNSAFE_PATHS = [
  '',
  '/abs.js',
  'a//b.js',
  './a.js',
  'a/../b.js',
  `a${String.fromCharCode(0)}b`,
];

describe('payload', () => {
  let driver: PayloadDriver;

  beforeEach(() => {
    driver = new PayloadDriver();
  });

  describe('normalizeArtifactPath', () => {
    it('should convert backslashes to slashes when path uses Windows separators', () => {
      expect(driver.get.normalized('assets\\logo.svg')).toBe('assets/logo.svg');
    });

    it.each(UNSAFE_PATHS)('should throw when path is %p', (path) => {
      expect(() => driver.get.normalized(path)).toThrow(/is unsafe/);
    });
  });

  describe('payloadRole', () => {
    it.each([
      ['remoteEntry.json', 'remoteEntry.json', 'remote-entry'],
      ['main.js.map', 'remoteEntry.json', 'source-map'],
      ['styles.css', 'remoteEntry.json', 'stylesheet'],
      ['chunk.js', 'remoteEntry.json', 'script'],
      ['chunk.mjs', 'remoteEntry.json', 'script'],
      ['chunk.cjs', 'remoteEntry.json', 'script'],
      ['logo.svg', 'remoteEntry.json', 'asset'],
    ])('should classify %s as %s when entry is %s', (path, entry, role) => {
      expect(driver.get.role(path, entry)).toBe(role);
    });
  });

  describe('payloadDescriptors', () => {
    it('should describe each file with digest, size, media type, and role when files exist', async () => {
      const contents = faker.lorem.paragraph();
      await driver.given.artifactRoot();
      await driver.given.file('styles.css', contents);

      expect(
        await driver.get.descriptors(['styles.css'], 'remoteEntry.json'),
      ).toStrictEqual([
        {
          path: 'styles.css',
          digest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
          size: Buffer.byteLength(contents),
          mediaType: 'text/css; charset=utf-8',
          cacheControl: 'public, max-age=31536000, immutable',
          role: 'stylesheet',
        },
      ]);
    });

    it('should reject when a path is unsafe', async () => {
      await driver.given.artifactRoot();

      await expect(
        driver.get.descriptors(['../escape.js'], 'remoteEntry.json'),
      ).rejects.toThrow(/is unsafe/);
    });
  });
});
