import {
  InvalidGeneratorIdError,
  MAX_ATLAS_ID_LENGTH,
  UnsupportedGeneratorFrameworkError,
} from '../errors/generator-errors.js';
import type { AtlasGeneratorOptions } from '../types/generator-types.js';
import {
  resolveAngularVersionProfileFromOptions,
  resolveReactVersionProfileFromOptions,
} from '../versions/generator-versions.js';

const ATLAS_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type SupportedGeneratorOptions = AtlasGeneratorOptions & {
  framework: 'angular' | 'react';
};

export function validateGeneratorOptions(
  options: AtlasGeneratorOptions,
): asserts options is SupportedGeneratorOptions {
  assertValidGeneratorName(options.name);

  if (options.hostId !== undefined) {
    assertValidAtlasId({ value: options.hostId, field: 'host id' });
  }

  assertSupportedGeneratorFramework(options);

  if (options.framework === 'angular') {
    resolveAngularVersionProfileFromOptions(options);
  } else {
    resolveReactVersionProfileFromOptions(options);
  }
}

export function assertValidGeneratorName(name: string): void {
  assertValidAtlasId({ value: name, field: 'name' });
}

export function assertSupportedGeneratorFramework(
  options: AtlasGeneratorOptions,
): asserts options is SupportedGeneratorOptions {
  if (options.framework !== 'angular' && options.framework !== 'react') {
    throw new UnsupportedGeneratorFrameworkError(options.framework);
  }
}

function assertValidAtlasId(options: {
  value: string;
  field: 'name' | 'host id';
}): void {
  const { value, field } = options;

  if (value.length > MAX_ATLAS_ID_LENGTH || !ATLAS_ID_PATTERN.test(value)) {
    throw new InvalidGeneratorIdError({ field, value });
  }
}
