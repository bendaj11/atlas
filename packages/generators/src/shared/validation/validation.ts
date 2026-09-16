import { generatorError } from '../errors/generator-error.js';
import type { AtlasGeneratorOptions } from '../types/generator-types.js';
import {
  angularVersionProfile,
  reactVersionProfile,
} from '../versions/generator-versions.js';

const MAX_ATLAS_ID_LENGTH = 214;
const ATLAS_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type SupportedGeneratorOptions = AtlasGeneratorOptions & {
  framework: 'angular' | 'react';
};

export function validateGeneratorOptions(
  options: AtlasGeneratorOptions,
): asserts options is SupportedGeneratorOptions {
  assertValidGeneratorName(options.name);
  if (options.hostId !== undefined)
    assertValidAtlasId(options.hostId, 'host id');
  assertSupportedGeneratorFramework(options);
  if (options.framework === 'angular') angularVersionProfile(options);
  else reactVersionProfile(options);
}

export function assertValidGeneratorName(name: string): void {
  assertValidAtlasId(name, 'name');
}

export function assertSupportedGeneratorFramework(
  options: AtlasGeneratorOptions,
): asserts options is SupportedGeneratorOptions {
  if (options.framework !== 'angular' && options.framework !== 'react') {
    throw generatorError({
      summary: `Unsupported Atlas generator framework "${options.framework}".`,
      suggestedActions: 'Pass --framework=angular or --framework=react.',
      code: 'ATLAS_GENERATOR_UNSUPPORTED_FRAMEWORK',
    });
  }
}

function assertValidAtlasId(value: string, field: 'name' | 'host id'): void {
  if (value.length > MAX_ATLAS_ID_LENGTH || !ATLAS_ID_PATTERN.test(value)) {
    throw generatorError({
      summary: `Invalid ${field} "${value}".`,
      suggestedActions: `Use 1-${MAX_ATLAS_ID_LENGTH} lowercase letters, numbers, and single hyphens between words, for example "orders-app".`,
      code: 'ATLAS_GENERATOR_INVALID_ID',
    });
  }
}
