import { beforeEach, describe, expect, it } from '@jest/globals';
import { GeneratedFilesDriver } from './files.driver.js';

describe('ensureAtlasGeneratedFilesIgnored', () => {
  let driver: GeneratedFilesDriver;

  beforeEach(() => {
    driver = new GeneratedFilesDriver();
  });

  it('should write workspace ignore file when project is contained', async () => {
    driver.given.ignoreFile('workspace');

    await driver.when.ensureIgnored();

    expect(driver.get.writtenFile()).toStrictEqual(
      driver.get.workspaceIgnoreFile(),
    );
  });

  it('should preserve ignore file when equivalent rule exists', async () => {
    driver.given.ignoreFile('existing');

    await driver.when.ensureIgnored();

    expect(driver.get.writtenFile()).toBeUndefined();
  });

  it('should write project ignore file when project is outside workspace', async () => {
    driver.given.ignoreFile('outside');

    await driver.when.ensureIgnored();

    expect(driver.get.writtenFile()).toStrictEqual(
      driver.get.projectIgnoreFile(),
    );
  });
});
