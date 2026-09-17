import { faker } from '@faker-js/faker';
import { UrlDriver } from './url.driver.js';

const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

describe('url', () => {
  let driver: UrlDriver;

  beforeEach(() => {
    driver = new UrlDriver();
  });

  describe('isLoopbackUrl', () => {
    it.each(LOOPBACK_HOSTS)('should return true when host is %s', (host) => {
      driver.given.value(`http://${host}:${faker.internet.port()}/`);

      expect(driver.get.loopback()).toBe(true);
    });

    it('should return false when host is remote', () => {
      driver.given.value(faker.internet.url());

      expect(driver.get.loopback()).toBe(false);
    });
  });

  describe('isSecureOrLoopbackUrl', () => {
    it('should return true when protocol is https', () => {
      driver.given.value(faker.internet.url({ protocol: 'https' }));

      expect(driver.get.secureOrLoopback()).toBe(true);
    });

    it('should return true when protocol is http on loopback', () => {
      driver.given.value('http://localhost:4400/');

      expect(driver.get.secureOrLoopback()).toBe(true);
    });

    it('should return false when protocol is http on a remote host', () => {
      driver.given.value(faker.internet.url({ protocol: 'http' }));

      expect(driver.get.secureOrLoopback()).toBe(false);
    });
  });

  describe('trimTrailingSlash', () => {
    it('should remove every trailing slash when value ends with slashes', () => {
      const base = faker.internet.url({ appendSlash: false });
      driver.given.value(`${base}//`);

      expect(driver.get.trimmed()).toBe(base);
    });

    it('should keep value when it has no trailing slash', () => {
      const base = faker.internet.url({ appendSlash: false });
      driver.given.value(base);

      expect(driver.get.trimmed()).toBe(base);
    });
  });

  describe('normalizeRoutePath', () => {
    it('should keep root when path is root', () => {
      driver.given.value('/');

      expect(driver.get.routePath()).toBe('/');
    });

    it('should remove trailing slashes when path is not root', () => {
      const segment = faker.word.noun();
      driver.given.value(`/${segment}//`);

      expect(driver.get.routePath()).toBe(`/${segment}`);
    });
  });
});
