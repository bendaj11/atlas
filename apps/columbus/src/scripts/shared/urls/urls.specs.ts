import {
  isExtensionPageUrl,
  isLoopbackHostname,
  isLoopbackUrl,
  isWebPageUrl,
} from './urls';

describe('isLoopbackHostname', () => {
  it.each(['localhost', '127.0.0.1', '[::1]'])(
    'should accept the hostname when it is %s',
    (hostname) => {
      expect(isLoopbackHostname(hostname)).toBe(true);
    },
  );

  it.each(['example.com', '10.0.0.1', 'localhost.evil.com'])(
    'should reject the hostname when it is %s',
    (hostname) => {
      expect(isLoopbackHostname(hostname)).toBe(false);
    },
  );
});

describe('isLoopbackUrl', () => {
  it('should accept the url when it is an http url on localhost', () => {
    expect(isLoopbackUrl('http://localhost:4200/app')).toBe(true);
  });

  it('should reject the url when it is a remote https url', () => {
    expect(isLoopbackUrl('https://shop.example/app')).toBe(false);
  });

  it('should reject the url when it is not a web url', () => {
    expect(isLoopbackUrl('chrome://extensions')).toBe(false);
  });
});

describe('isWebPageUrl', () => {
  it.each(['http://a', 'https://a'])(
    'should accept the url when it is %s',
    (url) => {
      expect(isWebPageUrl(url)).toBe(true);
    },
  );

  it.each(['chrome://a', 'file:///a', undefined])(
    'should reject the url when it is %s',
    (url) => {
      expect(isWebPageUrl(url)).toBe(false);
    },
  );
});

describe('isExtensionPageUrl', () => {
  it('should accept the url when it is a chrome-extension url', () => {
    expect(isExtensionPageUrl('chrome-extension://abc/index.html')).toBe(true);
  });

  it('should reject the url when it is a web url', () => {
    expect(isExtensionPageUrl('https://a')).toBe(false);
  });
});
