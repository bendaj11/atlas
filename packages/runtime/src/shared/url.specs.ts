import { isHttpProtocol, isLoopbackUrl } from './url.js';

describe('isLoopbackUrl', () => {
  it.each([
    ['http://localhost:4201/remoteEntry.json', true],
    ['http://127.0.0.1/remoteEntry.json', true],
    ['http://[::1]/remoteEntry.json', true],
    ['http://192.168.1.20/remoteEntry.json', false],
    ['not a url', false],
  ])('should return %s as %s when checked', (value, expected) => {
    expect(isLoopbackUrl(value)).toBe(expected);
  });
});

describe('isHttpProtocol', () => {
  it.each([
    ['http:', true],
    ['https:', true],
    ['ftp:', false],
    ['data:', false],
  ])('should return %s as %s when checked', (protocol, expected) => {
    expect(isHttpProtocol(protocol)).toBe(expected);
  });
});
