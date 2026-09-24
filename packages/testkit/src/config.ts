import { faker } from '@faker-js/faker';
import {
  ATLAS_FRAMEWORKS,
  type AtlasAppConfig,
  type AtlasHostConfig,
} from '@atlas/schema';

export function anAppConfig(
  overrides: Partial<AtlasAppConfig> = {},
): AtlasAppConfig {
  return {
    id: faker.string.uuid(),
    name: faker.commerce.productName(),
    framework: faker.helpers.arrayElement(ATLAS_FRAMEWORKS),
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
    framework: faker.helpers.arrayElement(ATLAS_FRAMEWORKS),
    type: 'host',
    ...overrides,
  };
}
