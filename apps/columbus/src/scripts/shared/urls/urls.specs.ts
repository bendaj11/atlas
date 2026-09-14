import {
  isExtensionPageUrl,
  isLoopbackHostname,
  isLoopbackUrl,
  isWebPageUrl,
} from './urls';

describe('isLoopbackHostname', () => {
  it.each(['localhost', '127.0.0.1', '[::1]'])(
    'should accept %s when hostname is loopback',
    (hostname) => {
      expect(isLoopbackHostname(hostname)).toBe(true);
    },
  );

  it.each(['example.com', '10.0.0.1', 'localhost.evil.com'])(
    'should reject %s when hostname is not loopback',
    (hostname) => {
      expect(isLoopbackHostname(hostname)).toBe(false);
    },
  );
});

describe('isLoopbackUrl', () => {
  it('should accept an http url on localhost', () => {
    expect(isLoopbackUrl('http://localhost:4200/app')).toBe(true);
  });

  it('should reject a remote https url', () => {
    expect(isLoopbackUrl('https://shop.example/app')).toBe(false);
  });

  it('should reject a non web url', () => {
    expect(isLoopbackUrl('chrome://extensions')).toBe(false);
  });
});

describe('isWebPageUrl', () => {
  it.each(['http://a', 'https://a'])('should accept %s', (url) => {
    expect(isWebPageUrl(url)).toBe(true);
  });

  it.each(['chrome://a', 'file:///a', undefined])('should reject %s', (url) => {
    expect(isWebPageUrl(url)).toBe(false);
  });
});

describe('isExtensionPageUrl', () => {
  it('should accept a chrome-extension url', () => {
    expect(isExtensionPageUrl('chrome-extension://abc/index.html')).toBe(true);
  });

  it('should reject a web url', () => {
    expect(isExtensionPageUrl('https://a')).toBe(false);
  });
});
