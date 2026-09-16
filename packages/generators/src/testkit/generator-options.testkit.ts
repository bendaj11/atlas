import { faker } from '@faker-js/faker';
import type {
  AngularStylesheetFormat,
  AtlasGeneratorOptions,
} from '../cli/generator-types.js';

export const ALL_GENERATOR_FRAMEWORKS = ['angular', 'react'] as const;
export const ALL_STYLESHEET_FORMATS: readonly AngularStylesheetFormat[] = [
  'css',
  'scss',
  'sass',
  'less',
];

export function anAtlasId(): string {
  return faker.lorem.slug({ min: 1, max: 3 });
}

export function aGeneratorOptions(
  overrides: Partial<AtlasGeneratorOptions> = {},
): AtlasGeneratorOptions {
  return {
    name: anAtlasId(),
    framework: faker.helpers.arrayElement(ALL_GENERATOR_FRAMEWORKS),
    ...overrides,
  };
}

export function anAngularGeneratorOptions(
  overrides: Partial<AtlasGeneratorOptions> = {},
): AtlasGeneratorOptions {
  return aGeneratorOptions({ framework: 'angular', ...overrides });
}

export function aReactGeneratorOptions(
  overrides: Partial<AtlasGeneratorOptions> = {},
): AtlasGeneratorOptions {
  return aGeneratorOptions({ framework: 'react', ...overrides });
}
