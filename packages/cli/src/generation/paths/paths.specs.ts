import { expect, it } from '@jest/globals';
import { parseProjectPath } from './paths.js';

it('should reject project path when parent traversal is present', () => {
  expect(() => parseProjectPath('../outside')).toThrow(/Invalid project name/);
});
