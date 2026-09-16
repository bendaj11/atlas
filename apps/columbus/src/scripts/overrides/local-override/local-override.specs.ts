/** @jest-environment node */

import { anAppManifest } from '@atlas/testkit';
import { LocalOverrideDriver } from './local-override.driver';

describe('validateLocalOverride', () => {
  let driver: LocalOverrideDriver;

  beforeEach(() => {
    driver = new LocalOverrideDriver();
  });

  it('should skip validation when the manifest is not local', async () => {
    await driver.given
      .manifest(anAppManifest({ channel: 'pr' }))
      .when.validated();

    expect(driver.get.fetchCount()).toBe(0);
  });

  it('should fetch the remote entry when the manifest is local', async () => {
    await driver.given
      .remoteEntry({
        name: 'orders',
        exposes: [{ key: './entry', outFileName: 'entry.js' }],
      })
      .when.validated();

    expect(driver.get.fetchedUrl()).toBe(
      'http://localhost:4513/remoteEntry.json',
    );
  });

  it('should accept the override when the remote entry exposes the entry module', async () => {
    await driver.given
      .remoteEntry({
        name: 'orders',
        exposes: [{ key: './entry', outFileName: 'entry.js' }],
      })
      .when.validated();

    expect(driver.get.errorMessage()).toBeUndefined();
  });

  it('should reject the override when the remote entry lacks the entry module', async () => {
    await driver.given
      .remoteEntry({
        name: 'orders',
        exposes: [{ key: './other', outFileName: 'o.js' }],
      })
      .when.validated();

    expect(driver.get.errorMessage()).toBe(
      'Local override remote entry does not expose ./entry.',
    );
  });

  it('should reject the override when the remote entry is not federation metadata', async () => {
    await driver.given.remoteEntry({ hello: 'world' }).when.validated();

    expect(driver.get.errorMessage()).toBe(
      'Local override remote entry is not valid federation metadata.',
    );
  });

  it('should reject the override when the remote entry responds with an error status', async () => {
    await driver.given.remoteEntryStatus(404).when.validated();

    expect(driver.get.errorMessage()).toBe(
      'Local override remote entry returned HTTP 404.',
    );
  });

  it('should reject the override when the remote entry is unreachable', async () => {
    await driver.given.unreachableRemoteEntry().when.validated();

    expect(driver.get.errorMessage()).toBe(
      'Local override remote entry is unreachable. Start its development server, then retry.',
    );
  });
});
