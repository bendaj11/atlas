import { faker } from '@faker-js/faker';
import { aHostManifest } from '@atlas/testkit';
import { SharedDependenciesDriver } from './shared-dependencies.driver.js';

describe('installHostSharedDependencies', () => {
  let driver: SharedDependenciesDriver;

  beforeEach(() => {
    driver = new SharedDependenciesDriver();
  });

  it('should append nothing when the remote declares no shared dependencies', () => {
    driver.when.installed({ metadata: {}, manifest: aHostManifest() });

    expect(driver.get.appendedElements()).toEqual([]);
  });

  it('should append nothing when the shared list is empty', () => {
    driver.when.installed({
      metadata: { shared: [] },
      manifest: aHostManifest(),
    });

    expect(driver.get.appendedElements()).toEqual([]);
  });

  describe('when the remote declares shared dependencies', () => {
    const manifest = aHostManifest();
    const shared = {
      packageName: faker.lorem.slug(),
      outFileName: `./${faker.system.commonFileName('js')}`,
    };

    it('should append a shim import map resolving each package next to the remote entry when installed', () => {
      driver.when.installed({ metadata: { shared: [shared] }, manifest });

      expect(driver.get.appendedElements()).toEqual([
        {
          tagName: 'script',
          type: 'importmap-shim',
          textContent: JSON.stringify({
            imports: {
              [shared.packageName]: new URL(
                shared.outFileName,
                manifest.remoteEntryUrl,
              ).href,
            },
          }),
        },
      ]);
    });

    it('should reject when a shared dependency lacks its file name', () => {
      const invalid = { packageName: shared.packageName };
      driver.when.installed({ metadata: { shared: [invalid] }, manifest });

      expect(driver.get.error()).toMatchObject({
        code: 'HOST_REMOTE_INVALID',
        summary: `Selected host remote entry "${manifest.remoteEntryUrl}" declares shared dependency ${JSON.stringify(invalid)} without packageName and outFileName.`,
      });
    });
  });
});
