import { faker } from '@faker-js/faker';
import { aHostManifest, aHostRuntimeConfig } from '@atlas/testkit';
import { HostStylesDriver } from './host-styles.driver.js';

describe('loadHostStyles', () => {
  let driver: HostStylesDriver;

  beforeEach(() => {
    driver = new HostStylesDriver();
  });

  it('should append nothing when the manifest declares no styles', () => {
    driver.when.loaded({
      manifest: aHostManifest(),
      runtime: aHostRuntimeConfig(),
    });

    expect(driver.get.appendedElements()).toEqual([]);
  });

  describe('when the manifest declares styles', () => {
    const runtime = aHostRuntimeConfig();
    const plain = { href: faker.internet.url() };
    const verified = {
      href: faker.internet.url(),
      integrity: `sha256-${faker.string.alphanumeric(43)}=`,
    };
    const manifest = aHostManifest({ styles: [plain, verified] });

    beforeEach(() => {
      driver.when.loaded({ manifest, runtime });
    });

    it('should validate each stylesheet URL against the manifest when loaded', () => {
      expect(driver.get.validateArtifactUrlMock()).toHaveBeenCalledWith({
        url: new URL(verified.href),
        manifest,
        runtime,
      });
    });

    it('should append a stylesheet link without integrity when the stylesheet has none', () => {
      expect(driver.get.appendedElements()).toContainEqual({
        tagName: 'link',
        rel: 'stylesheet',
        href: plain.href,
      });
    });

    it('should append an anonymous stylesheet link with integrity when the stylesheet has one', () => {
      expect(driver.get.appendedElements()).toContainEqual({
        tagName: 'link',
        rel: 'stylesheet',
        href: verified.href,
        integrity: verified.integrity,
        crossOrigin: 'anonymous',
      });
    });
  });
});
