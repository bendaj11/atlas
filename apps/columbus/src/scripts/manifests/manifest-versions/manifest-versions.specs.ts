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

  it('should sort production and PR versions newest first when dates differ', () => {
    driver.given
      .version({
        channel: 'production',
        version: '1.0.0',
        buildId: 'production-old',
        createdAt: '2026-01-01T00:00:00.000Z',
      })
      .given.version({
        channel: 'pr',
        version: '1.0.0-pr.7',
        buildId: 'pr-old',
        prNumber: 7,
        createdAt: '2026-01-02T00:00:00.000Z',
      })
      .given.version({
        channel: 'production',
        version: '2.0.0',
        buildId: 'production-new',
        createdAt: '2026-01-03T00:00:00.000Z',
      })
      .given.version({
        channel: 'pr',
        version: '1.0.0-pr.8',
        buildId: 'pr-new',
        prNumber: 8,
        createdAt: '2026-01-04T00:00:00.000Z',
      });

    expect(driver.get.versionKeys()).toStrictEqual([
      'production:2.0.0:production-new',
      'production:1.0.0:production-old',
      'pr:1.0.0-pr.8:pr-new',
      'pr:1.0.0-pr.7:pr-old',
    ]);
  });

  it('should put versions without creation dates after dated versions', () => {
    driver.given
      .version({
        version: '1.0.0',
        buildId: 'historical',
        createdAt: '2026-01-01T00:00:00.000Z',
      })
      .given.version({ version: '1.1.0', buildId: 'current' });

    expect(driver.get.versionKeys()).toStrictEqual([
      'production:1.0.0:historical',
      'production:1.1.0:current',
    ]);
  });
});
