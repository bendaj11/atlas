import { describe, expect, it } from '@jest/globals';
import { canonicalJson } from './registry-revision.js';

describe('registry revision', () => {
  it('should serialize objects deterministically when key order differs', () => {
    expect(canonicalJson({ beta: 2, alpha: 1 })).toBe(
      canonicalJson({ alpha: 1, beta: 2 }),
    );
  });
});
