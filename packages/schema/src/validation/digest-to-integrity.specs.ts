import { digestToIntegrity } from './digest-to-integrity.js';

describe('digestToIntegrity', () => {
  it.each([
    [`sha256:${'00'.repeat(32)}`, `sha256-${'A'.repeat(43)}=`],
    [
      `sha256:${'ff'.repeat(32)}`,
      'sha256-//////////////////////////////////////////8=',
    ],
  ])('should convert %s to base64 SRI when converted', (digest, integrity) => {
    expect(digestToIntegrity(digest)).toBe(integrity);
  });
});
