import { faker } from '@faker-js/faker';
import type { AtlasAppConfig, AtlasHostConfig } from '@atlas/schema';
import { ALL_FRAMEWORKS } from './manifests.js';

export function anAppConfig(
  overrides: Partial<AtlasAppConfig> = {},
): AtlasAppConfig {
  return {
    id: faker.string.uuid(),
    name: faker.commerce.productName(),
    framework: faker.helpers.arrayElement(ALL_FRAMEWORKS),
    type: 'app',
    ...overrides,
  };
}

export function aHostConfig(
  overrides: Partial<AtlasHostConfig> = {},
): AtlasHostConfig {
  return {
    id: faker.string.uuid(),
    name: faker.commerce.productName(),
    framework: faker.helpers.arrayElement(ALL_FRAMEWORKS),
    type: 'host',
    ...overrides,
  };
}
