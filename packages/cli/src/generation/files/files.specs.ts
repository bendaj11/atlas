import { faker } from '@faker-js/faker';
import { GeneratedFilesDriver } from './files.driver.js';

describe('ensureAtlasGeneratedFilesIgnored', () => {
  let driver: GeneratedFilesDriver;
  const workspaceRoot = `/workspace/${faker.string.alphanumeric(8)}`;

  beforeEach(() => {
    driver = new GeneratedFilesDriver();
  });

  it('should create the workspace .gitignore when the project is inside and none exists', async () => {
    driver.given.ignoreFile(undefined);

    await driver.when.ignored(workspaceRoot, `${workspaceRoot}/apps/orders`);

    expect(driver.get.writeIgnoreMock()).toHaveBeenCalledWith(
      `${workspaceRoot}/.gitignore`,
      '.atlas/\n',
    );
  });

  it('should append the rule when the workspace .gitignore lacks it', async () => {
    driver.given.ignoreFile('dist/\n');

    await driver.when.ignored(workspaceRoot, `${workspaceRoot}/apps/orders`);

    expect(driver.get.writeIgnoreMock()).toHaveBeenCalledWith(
      `${workspaceRoot}/.gitignore`,
      'dist/\n.atlas/\n',
    );
  });

  it.each(['.atlas', '.atlas/', '**/.atlas', '**/.atlas/'])(
    'should leave the file untouched when it already contains %s',
    async (rule) => {
      driver.given.ignoreFile(`dist/\n${rule}\n`);

      await driver.when.ignored(workspaceRoot, `${workspaceRoot}/apps/orders`);

      expect(driver.get.writeIgnoreMock()).not.toHaveBeenCalled();
    },
  );

  it('should write the project .gitignore when the project is outside the workspace', async () => {
    const projectRoot = `/external/${faker.string.alphanumeric(8)}`;
    driver.given.ignoreFile(undefined);

    await driver.when.ignored(workspaceRoot, projectRoot);

    expect(driver.get.writeIgnoreMock()).toHaveBeenCalledWith(
      `${projectRoot}/.gitignore`,
      '.atlas/\n',
    );
  });
});
