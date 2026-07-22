import { beforeEach, describe, expect, it } from '@jest/globals';
import { ManifestVersionsDriver } from './manifest-versions.driver.js';

describe('unique manifest versions', () => {
  let driver: ManifestVersionsDriver;

  beforeEach(() => {
    driver = new ManifestVersionsDriver();
  });

  it('should sort production before PR and local when history is unordered', () => {
    driver.given
      .version({ channel: 'local', buildId: 'local' })
      .given.version({
        channel: 'pr',
        version: '1.0.0-pr.42',
        buildId: 'pull-request',
        prNumber: 42,
      })
      .given.version({
        channel: 'production',
        buildId: 'production',
        createdAt: '2026-01-01T00:00:00.000Z',
      });

    expect(driver.get.channels()).toStrictEqual(['production', 'pr', 'local']);
  });
});
