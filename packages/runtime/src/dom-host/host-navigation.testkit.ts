import { faker } from '@faker-js/faker';
import type { AtlasHostNavigationItem } from './host-navigation.types.js';

export function aNavigationItem(
  overrides: Partial<AtlasHostNavigationItem> = {},
): AtlasHostNavigationItem {
  const path = `/${faker.word.noun()}`;

  return {
    id: faker.string.uuid(),
    appId: faker.string.uuid(),
    appName: faker.commerce.productName(),
    path,
    href: path,
    label: faker.commerce.productName(),
    order: faker.number.int({ max: 100 }),
    active: faker.datatype.boolean(),
    navigate: () => undefined,
    ...overrides,
  };
}
