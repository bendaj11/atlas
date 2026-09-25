import { faker } from '@faker-js/faker';
import { PublicationFilesDriver } from './publication-files.driver.js';

describe('publication-files', () => {
  let driver: PublicationFilesDriver;

  beforeEach(async () => {
    driver = new PublicationFilesDriver();

    await driver.given.sourceDirectory();
  });

  describe('publicationFiles', () => {
    it('should place payloads under the release prefix when the manifest is a release', async () => {
      await driver.given.payload('main.js', faker.lorem.sentence());
      const manifest = driver.get.manifest();

      const files = await driver.get.files();

      expect(files.payloads.map(({ path }) => path)).toStrictEqual([
        `apps/${manifest.id}/${manifest.release!.version}/main.js`,
      ]);
    });

    it('should place the manifest under a digest-scoped preview prefix when the manifest is a preview', async () => {
      driver.given.preview(42);
      const manifest = driver.get.manifest();

      const files = await driver.get.files();

      expect(files.manifest.path).toMatch(
        new RegExp(
          `^apps/${manifest.id}/previews/42/[0-9a-f]{64}/manifest\\.json$`,
        ),
      );
    });

    it('should mark the manifest immutable JSON when files are prepared', async () => {
      expect((await driver.get.files()).manifest.metadata).toStrictEqual({
        cacheControl: 'public, max-age=31536000, immutable',
        contentType: 'application/json',
      });
    });

    it('should reject when a payload changed after manifest generation', async () => {
      await driver.given.payload('main.js', 'actual', 'declared');

      await expect(driver.get.files()).rejects.toThrow(
        'Atlas payload main.js changed after manifest generation.',
      );
    });
  });

  describe('publicationIdentity', () => {
    it('should describe a release when the manifest carries a release', () => {
      const manifest = driver.get.manifest();

      expect(driver.get.identity()).toBe(
        `app ${manifest.name} (${manifest.id}), release ${manifest.release!.version}`,
      );
    });
  });

  describe('uploadAndVerify', () => {
    it('should store every file when uploads succeed', async () => {
      await driver.given.payload('main.js', faker.lorem.sentence());
      const files = await driver.get.files();

      await driver.when.uploaded(files);

      expect(driver.get.storedPaths()).toStrictEqual([
        files.payloads[0]!.path,
        files.manifest.path,
      ]);
    });

    it('should upload the manifest after every payload', async () => {
      await driver.given.payload('a.js', faker.lorem.sentence());
      await driver.given.payload('b.js', faker.lorem.sentence());
      await driver.given.payload('c.js', faker.lorem.sentence());
      const files = await driver.get.files();

      await driver.when.uploaded(files);

      expect(driver.get.createdPaths().at(-1)).toBe(files.manifest.path);
    });

    it('should read back every file when storage does not verify created objects', async () => {
      await driver.given.payload('main.js', faker.lorem.sentence());
      const files = await driver.get.files();

      await driver.when.uploaded(files);

      expect(driver.get.readPaths()).toStrictEqual([
        files.payloads[0]!.path,
        files.manifest.path,
      ]);
    });

    it('should skip read-back when storage verifies created objects', async () => {
      await driver.given.payload('main.js', faker.lorem.sentence());
      driver.given.storageVerifyingCreatedObjects();
      const files = await driver.get.files();

      await driver.when.uploaded(files);

      expect(driver.get.readPaths()).toStrictEqual([]);
    });

    it('should report each uploaded and verified file when uploads succeed', async () => {
      await driver.given.payload('main.js', 'abc');
      const files = await driver.get.files();
      const size = `${3 + files.manifest.bytes.byteLength} B`;

      await driver.when.uploaded(files);

      expect(driver.get.progress()).toStrictEqual([
        `Uploading files 0/2 (${size})`,
        `Uploading files 1/2 (${size})`,
        `Uploading files 2/2 (${size})`,
        `Uploaded 2 files (${size})`,
        'Verifying uploaded files 0/2',
        'Verifying uploaded files 1/2',
        'Verifying uploaded files 2/2',
        'Verified 2 uploaded files',
      ]);
    });

    it('should accept an existing object when its bytes and metadata match', async () => {
      const files = await driver.get.files();
      driver.given.storedObject(files.manifest);

      await expect(
        driver.when.uploaded({ payloads: [], manifest: files.manifest }),
      ).resolves.toBeUndefined();
    });

    it('should reject when an existing object holds different bytes', async () => {
      const files = await driver.get.files();
      driver.given.storedObject({
        ...files.manifest,
        bytes: new Uint8Array([9]),
      });

      await expect(
        driver.when.uploaded({ payloads: [], manifest: files.manifest }),
      ).rejects.toThrow(
        `Immutable publication object already exists: ${files.manifest.path}`,
      );
    });

    it('should not upload the manifest when a payload upload fails', async () => {
      await driver.given.payload('main.js', faker.lorem.sentence());
      const files = await driver.get.files();
      driver.given.storedObject({
        ...files.payloads[0]!,
        bytes: new Uint8Array([9]),
      });

      await driver.when.uploaded(files).catch(() => undefined);

      expect(driver.get.createdPaths()).not.toContain(files.manifest.path);
    });
  });
});
