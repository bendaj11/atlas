import { faker } from '@faker-js/faker';
import { FsDriver } from './fs.driver.js';

describe('fs', () => {
  let driver: FsDriver;

  beforeEach(async () => {
    driver = new FsDriver();

    await driver.given.directory();
  });

  describe('exists', () => {
    it('should return true when path is a file', async () => {
      const name = driver.get.missingName();
      await driver.given.file(name, faker.lorem.word());

      expect(await driver.get.exists(name)).toBe(true);
    });

    it('should return false when path is missing', async () => {
      expect(await driver.get.exists(driver.get.missingName())).toBe(false);
    });

    it('should return false when a path segment is a file', async () => {
      const name = driver.get.missingName();
      await driver.given.file(name, faker.lorem.word());

      expect(await driver.get.exists(join(name, 'child'))).toBe(false);
    });
  });

  describe('readTextFile', () => {
    it('should return contents when file exists', async () => {
      const name = driver.get.missingName();
      const contents = faker.lorem.sentence();
      await driver.given.file(name, contents);

      expect(await driver.get.text(name)).toBe(contents);
    });

    it('should return undefined when file is missing', async () => {
      expect(await driver.get.text(driver.get.missingName())).toBeUndefined();
    });

    it('should reject when path is a directory', async () => {
      const name = driver.get.missingName();
      await driver.given.subdirectory(name);

      await expect(driver.get.text(name)).rejects.toMatchObject({
        code: 'EISDIR',
      });
    });
  });

  describe('readJsonFile', () => {
    it('should return parsed value when file holds JSON', async () => {
      const name = driver.get.missingName();
      const value = { id: faker.string.uuid() };
      await driver.given.file(name, JSON.stringify(value));

      expect(await driver.get.json(name)).toStrictEqual(value);
    });

    it('should return undefined when file is missing', async () => {
      expect(await driver.get.json(driver.get.missingName())).toBeUndefined();
    });

    it('should reject with file path when contents are not JSON', async () => {
      const name = driver.get.missingName();
      await driver.given.file(name, '{ not json');

      await expect(driver.get.json(name)).rejects.toThrow(
        new RegExp(`${name} is not valid JSON`),
      );
    });
  });

  describe('writeJsonFile', () => {
    it('should write pretty JSON with trailing newline when value is written', async () => {
      const name = driver.get.missingName();
      const value = { id: faker.string.uuid() };

      await driver.when.jsonWritten(name, value);

      expect(await driver.get.text(name)).toBe(
        `${JSON.stringify(value, null, 2)}\n`,
      );
    });
  });
});

function join(...segments: string[]): string {
  return segments.join('/');
}
