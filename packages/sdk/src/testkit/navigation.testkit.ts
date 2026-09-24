import { jest } from '@jest/globals';
import { createMemoryNavigation } from '@atlas/testkit';
import type {
  AtlasLocation,
  AtlasNavigation,
  GoBack,
  GoThroughHistory,
  NavigateToPath,
  ReplacePath,
} from '../navigation/navigation-types/navigation-types.js';

export interface MemoryNavigation extends AtlasNavigation {
  readonly back: jest.Mock<GoBack>;
  readonly go: jest.Mock<GoThroughHistory>;
  readonly navigate: jest.Mock<NavigateToPath>;
  readonly replace: jest.Mock<ReplacePath>;
}

export function aMemoryNavigation(initialUrl = '/'): MemoryNavigation {
  const navigation = createMemoryNavigation(initialUrl);

  return {
    navigate: jest.fn<NavigateToPath>((to, options) =>
      navigation.navigate(to, options),
    ),
    replace: jest.fn<ReplacePath>((to) => navigation.replace(to)),
    back: jest.fn<GoBack>(),
    go: jest.fn<GoThroughHistory>(),
    createHref: (to) => navigation.createHref(to),
    subscribe: (listener) => navigation.subscribe(listener),
    getCurrentLocation: () => navigation.getCurrentLocation(),
  };
}

export function parseUrlIntoLocation(value: string): AtlasLocation {
  const url = new URL(value, 'http://atlas.local');

  return { pathname: url.pathname, search: url.search, hash: url.hash };
}

export function formatLocationAsUrl(location: AtlasLocation): string {
  return `${location.pathname}${location.search}${location.hash}`;
}
