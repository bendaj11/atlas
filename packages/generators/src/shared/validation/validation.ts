import type { AtlasGeneratorOptions } from '../types/generator-types.js';

const MAX_ATLAS_ID_LENGTH = 214;
const ATLAS_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function assertValidGeneratorOptions(
  options: AtlasGeneratorOptions,
): void {
  assertValidAtlasId(options.name, 'name');
  if (options.hostId !== undefined)
    assertValidAtlasId(options.hostId, 'hostId');
}

export function assertSupportedGeneratorFramework(
  options: AtlasGeneratorOptions,
): asserts options is AtlasGeneratorOptions & {
  framework: 'angular' | 'react';
} {
  if (options.framework !== 'angular' && options.framework !== 'react') {
    throw new Error(
      `Unsupported Atlas generator framework: ${options.framework}. Use angular or react.`,
    );
  }
}

function assertValidAtlasId(value: string, field: 'name' | 'hostId'): void {
  if (value.length > MAX_ATLAS_ID_LENGTH || !ATLAS_ID_PATTERN.test(value)) {
    throw new Error(
      `Invalid generator ${field} "${value}". Use 1-${MAX_ATLAS_ID_LENGTH} lowercase letters, numbers, and single hyphens between words.`,
    );
  }
}
