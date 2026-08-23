import { describe, expect, it } from '@jest/globals';
import { placementTargetsHost } from './atlas-placement.js';

describe('placementTargetsHost', () => {
  it('should target host when placement names that host', () => {
    expect(placementTargetsHost({ hostId: 'storefront' }, 'storefront')).toBe(
      true,
    );
  });

  it('should target host when placement uses wildcard', () => {
    expect(placementTargetsHost({ hostId: '*' }, 'storefront')).toBe(true);
  });

  it('should not target host when placement names another host', () => {
    expect(placementTargetsHost({ hostId: 'admin' }, 'storefront')).toBe(false);
  });
});
