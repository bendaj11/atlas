import { UrlsDriver } from './urls.driver';

describe('isLoopbackHostname', () => {
  let driver: UrlsDriver;

  beforeEach(() => {
    driver = new UrlsDriver();
  });

  it.each(['localhost', '127.0.0.1', '[::1]'])(
    'should accept the hostname when it is %s',
    (hostname) => {
      driver.when.loopbackHostnameChecked(hostname);

      expect(driver.get.result()).toBe(true);
    },
  );

  it.each(['example.com', '10.0.0.1', 'localhost.evil.com'])(
    'should reject the hostname when it is %s',
    (hostname) => {
      driver.when.loopbackHostnameChecked(hostname);

      expect(driver.get.result()).toBe(false);
    },
  );
});

describe('isLoopbackUrl', () => {
  let driver: UrlsDriver;

  beforeEach(() => {
    driver = new UrlsDriver();
  });

  it('should accept the url when it is an http url on localhost', () => {
    driver.when.loopbackUrlChecked('http://localhost:4200/app');

    expect(driver.get.result()).toBe(true);
  });

  it('should reject the url when it is a remote https url', () => {
    driver.when.loopbackUrlChecked('https://shop.example/app');

    expect(driver.get.result()).toBe(false);
  });

  it('should reject the url when it is not a web url', () => {
    driver.when.loopbackUrlChecked('chrome://extensions');

    expect(driver.get.result()).toBe(false);
  });
});

describe('isWebPageUrl', () => {
  let driver: UrlsDriver;

  beforeEach(() => {
    driver = new UrlsDriver();
  });

  it.each(['http://a', 'https://a'])(
    'should accept the url when it is %s',
    (url) => {
      driver.when.webPageUrlChecked(url);

      expect(driver.get.result()).toBe(true);
    },
  );

  it.each(['chrome://a', 'file:///a', undefined])(
    'should reject the url when it is %s',
    (url) => {
      driver.when.webPageUrlChecked(url);

      expect(driver.get.result()).toBe(false);
    },
  );
});

describe('isExtensionPageUrl', () => {
  let driver: UrlsDriver;

  beforeEach(() => {
    driver = new UrlsDriver();
  });

  it('should accept the url when it is a chrome-extension url', () => {
    driver.when.extensionPageUrlChecked('chrome-extension://abc/index.html');

    expect(driver.get.result()).toBe(true);
  });

  it('should reject the url when it is a web url', () => {
    driver.when.extensionPageUrlChecked('https://a');

    expect(driver.get.result()).toBe(false);
  });
});
