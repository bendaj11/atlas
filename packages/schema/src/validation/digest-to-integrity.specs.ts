import { convertDigestToIntegrity } from './digest-to-integrity.js';

describe('convertDigestToIntegrity', () => {
  it.each([
    [`sha256:${'00'.repeat(32)}`, `sha256-${'A'.repeat(43)}=`],
    [
      `sha256:${'ff'.repeat(32)}`,
      'sha256-//////////////////////////////////////////8=',
    ],
  ])('should convert %s to base64 SRI when converted', (digest, integrity) => {
    expect(convertDigestToIntegrity(digest)).toBe(integrity);
  });
});
