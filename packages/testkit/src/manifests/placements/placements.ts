import { faker } from '@faker-js/faker';
import {
  ATLAS_ROUTE_MATCHES,
  type AtlasPlacement,
  type AtlasRouteContribution,
} from '@atlas/schema';

export function aRouteContribution(
  overrides: Partial<AtlasRouteContribution> = {},
): AtlasRouteContribution {
  return {
    path: `/${faker.lorem.slug()}`,
    match: faker.helpers.arrayElement(ATLAS_ROUTE_MATCHES),
    title: faker.lorem.words(),
    nav: {
      label: faker.lorem.word(),
      order: faker.number.int({ max: 100 }),
      visible: faker.datatype.boolean(),
    },
    ...overrides,
  };
}

export function aRoutePlacement(
  overrides: Partial<AtlasPlacement> & {
    route?: Partial<AtlasRouteContribution>;
  } = {},
): AtlasPlacement {
  const { route, ...placement } = overrides;

  return {
    id: faker.string.uuid(),
    kind: 'route',
    hostId: faker.string.uuid(),
    route: aRouteContribution(route),
    ...placement,
  };
}

export function aSlotPlacement(
  overrides: Partial<AtlasPlacement> = {},
): AtlasPlacement {
  return {
    id: faker.string.uuid(),
    kind: 'slot',
    hostId: faker.string.uuid(),
    slot: faker.lorem.slug(),
    ...overrides,
  };
}
