import { describe, expect, it } from '@jest/globals';
import { createAtlasBootstrapFiles } from './bootstrap-files.js';

describe('createAtlasBootstrapFiles', () => {
  it('should include module shim when bootstrap files are created', () => {
    expect(createAtlasBootstrapFiles({}).map(({ path }) => path)).toContain(
      'es-module-shims.js',
    );
  });
});
