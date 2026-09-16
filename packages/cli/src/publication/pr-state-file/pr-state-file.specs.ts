import { faker } from '@faker-js/faker';
import { PullRequestStateDriver } from './pr-state-file.driver.js';

describe('readOpenPreviews', () => {
  let driver: PullRequestStateDriver;

  beforeEach(() => {
    driver = new PullRequestStateDriver();
  });

  it('should return artifact preview sets when the state is complete', async () => {
    const appId = faker.string.uuid();
    const hostId = faker.string.uuid();
    const previews = faker.helpers.uniqueArray(
      () => faker.number.int({ min: 1, max: 10_000 }),
      2,
    );
    driver.given.stateFile({
      schemaVersion: '1',
      complete: true,
      artifacts: [
        { kind: 'app', id: appId, openPreviews: previews },
        { kind: 'host', id: hostId, openPreviews: [] },
      ],
    });

    expect(await driver.get.previews()).toStrictEqual([
      { kind: 'app', id: appId, openPreviews: new Set(previews) },
      { kind: 'host', id: hostId, openPreviews: new Set() },
    ]);
  });

  it('should reject when the state file cannot be read', async () => {
    driver.given.unreadableStateFile();

    await expect(driver.get.previews()).rejects.toThrow(
      `Atlas could not read the authoritative preview state file "${driver.get.path()}".`,
    );
  });

  it('should reject when the state file is not JSON', async () => {
    driver.given.stateFile('{ nope');

    await expect(driver.get.previews()).rejects.toThrow(
      /could not read the authoritative preview state file/,
    );
  });

  it('should reject when the state is not marked complete', async () => {
    driver.given.stateFile({ schemaVersion: '1', artifacts: [] });

    await expect(driver.get.previews()).rejects.toThrow(/"complete": true/);
  });

  it('should reject when an artifact appears twice', async () => {
    const id = faker.string.uuid();
    driver.given.stateFile({
      schemaVersion: '1',
      complete: true,
      artifacts: [
        { kind: 'app', id, openPreviews: [] },
        { kind: 'app', id, openPreviews: [] },
      ],
    });

    await expect(driver.get.previews()).rejects.toThrow(/"artifacts"/);
  });

  it('should reject when an artifact id could escape its storage prefix', async () => {
    driver.given.stateFile({
      schemaVersion: '1',
      complete: true,
      artifacts: [{ kind: 'app', id: '../apps', openPreviews: [] }],
    });

    await expect(driver.get.previews()).rejects.toThrow(/"artifacts"/);
  });
});
