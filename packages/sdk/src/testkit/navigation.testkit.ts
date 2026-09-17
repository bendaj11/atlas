import { jest } from '@jest/globals';
import type {
  AtlasLocation,
  AtlasNavigation,
  AtlasNavigationListener,
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
  let location = parseUrlIntoLocation(initialUrl);
  const listeners = new Set<AtlasNavigationListener>();
  const notify = (): void => {
    for (const listener of listeners) listener(location);
  };
  const move = (to: string): void => {
    location = parseUrlIntoLocation(to);
    notify();
  };

  return {
    navigate: jest.fn<NavigateToPath>((to) => move(to)),
    replace: jest.fn<ReplacePath>((to) => move(to)),
    back: jest.fn<GoBack>(),
    go: jest.fn<GoThroughHistory>(),
    createHref: (to) => to,
    subscribe(listener) {
      listeners.add(listener);
      listener(location);

      return () => listeners.delete(listener);
    },
    getCurrentLocation: () => location,
  };
}

export function parseUrlIntoLocation(value: string): AtlasLocation {
  const url = new URL(value, 'http://atlas.local');

  return { pathname: url.pathname, search: url.search, hash: url.hash };
}

export function formatLocationAsUrl(location: AtlasLocation): string {
  return `${location.pathname}${location.search}${location.hash}`;
}
