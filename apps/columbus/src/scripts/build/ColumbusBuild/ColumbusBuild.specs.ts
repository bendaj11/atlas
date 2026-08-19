import { beforeEach, describe, expect, it } from '@jest/globals';
import { ColumbusBuildDriver } from './ColumbusBuild.driver.js';

describe('Columbus extension build', () => {
  let driver: ColumbusBuildDriver;

  beforeEach(() => {
    driver = new ColumbusBuildDriver();
  });

  it('should expose required Chrome extension capabilities when build is read', async () => {
    await driver.when.manifestRead();

    expect(driver.get.manifest()).toMatchObject({
      manifest_version: 3,
      minimum_chrome_version: '111',
      permissions: ['activeTab', 'scripting', 'storage'],
      host_permissions: ['http://localhost/*', 'http://127.0.0.1/*'],
      background: { service_worker: 'background.js' },
      action: { default_popup: 'index.html' },
    });
  });

  it('should not inject a catalog interceptor when build is read', async () => {
    await driver.when.manifestRead();

    expect(driver.get.manifest().content_scripts).toEqual([
      {
        js: ['badge-script.js'],
        matches: ['http://*/*', 'https://*/*'],
        run_at: 'document_idle',
      },
    ]);
  });

  it('should use the dark Columbus mark as the default Chrome icon', async () => {
    await driver.when.manifestRead();

    expect(driver.get.manifest()).toMatchObject({
      icons: {
        16: 'icons/columbus-dark-16.png',
        32: 'icons/columbus-dark-32.png',
        48: 'icons/columbus-dark-48.png',
        128: 'icons/columbus-dark-128.png',
      },
      action: {
        default_icon: {
          16: 'icons/columbus-dark-16.png',
          32: 'icons/columbus-dark-32.png',
        },
      },
    });
  });
});
