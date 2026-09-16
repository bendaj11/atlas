import { jest } from '@jest/globals';
import type {
  AtlasLocation,
  AtlasNavigation,
  AtlasNavigationListener,
} from '../navigation/navigation-types/navigation-types.js';

export interface MemoryNavigation extends AtlasNavigation {
  readonly back: jest.Mock<AtlasNavigation['back']>;
  readonly go: jest.Mock<NonNullable<AtlasNavigation['go']>>;
  readonly navigate: jest.Mock<AtlasNavigation['navigate']>;
  readonly replace: jest.Mock<AtlasNavigation['replace']>;
}

export function aMemoryNavigation(initialUrl = '/'): MemoryNavigation {
  let location = splitUrl(initialUrl);
  const listeners = new Set<AtlasNavigationListener>();
  const notify = (): void => {
    for (const listener of listeners) listener(location);
  };
  const move = (to: string): void => {
    location = splitUrl(to);
    notify();
  };

  return {
    navigate: jest.fn<AtlasNavigation['navigate']>((to) => move(to)),
    replace: jest.fn<AtlasNavigation['replace']>((to) => move(to)),
    back: jest.fn<AtlasNavigation['back']>(),
    go: jest.fn<NonNullable<AtlasNavigation['go']>>(),
    createHref: (to) => to,
    subscribe(listener) {
      listeners.add(listener);
      listener(location);

      return () => listeners.delete(listener);
    },
    getCurrentLocation: () => location,
  };
}

export function splitUrl(value: string): AtlasLocation {
  const url = new URL(value, 'http://atlas.local');

  return { pathname: url.pathname, search: url.search, hash: url.hash };
}

export function urlOf(location: AtlasLocation): string {
  return `${location.pathname}${location.search}${location.hash}`;
}
