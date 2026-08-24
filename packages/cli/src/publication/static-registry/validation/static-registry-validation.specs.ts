import { describe, expect, it } from '@jest/globals';
import { emptyStaticRegistry } from '../static-registry.js';
import { assertStaticRegistry } from './static-registry-validation.js';

describe('static registry validation', () => {
  it('should accept registry when content revision is valid', () => {
    expect(() => assertStaticRegistry(emptyStaticRegistry())).not.toThrow();
  });

  it('should reject registry when content revision is stale', () => {
    const registry = emptyStaticRegistry();
    registry.revision = `sha256:${'0'.repeat(64)}`;

    expect(() => assertStaticRegistry(registry)).toThrow(/revision is invalid/);
  });
});
