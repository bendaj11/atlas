import { stringifyCanonicalJson } from './registry-revision.js';

describe('registry revision', () => {
  it('should serialize objects deterministically when key order differs', () => {
    expect(stringifyCanonicalJson({ beta: 2, alpha: 1 })).toBe(
      stringifyCanonicalJson({ alpha: 1, beta: 2 }),
    );
  });
});
