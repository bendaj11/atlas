import { faker } from '@faker-js/faker';
import { anAppManifest } from '@atlas/testkit';
import type { AtlasAppContext } from '../lifecycle.js';
import { createRouteContext } from '../navigation/route-context/route-context.js';
import { createScopedNavigation } from '../navigation/scoped-navigation/scoped-navigation.js';
import { aMemoryNavigation } from './navigation.testkit.js';

export function anAppContext(
  overrides: Partial<AtlasAppContext> = {},
): AtlasAppContext {
  const path = overrides.path ?? `/${faker.lorem.slug()}`;
  const hostNavigation = aMemoryNavigation(path);

  return {
    manifest: anAppManifest(),
    hostId: faker.string.uuid(),
    path,
    navigation: createScopedNavigation(path, hostNavigation),
    route: createRouteContext(path, hostNavigation),
    loading: {
      show: () => undefined,
      hide: () => undefined,
      waitUntilReady: () => () => undefined,
    },
    ...overrides,
  };
}
