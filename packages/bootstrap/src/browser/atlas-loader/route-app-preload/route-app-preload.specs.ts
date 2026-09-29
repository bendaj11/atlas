/** @jest-environment jsdom */
import { faker } from '@faker-js/faker';
import {
  aHostCatalog,
  anAppManifest,
  aRoutePlacement,
  aSlotPlacement,
} from '@atlas/testkit';
import { preloadActiveRouteApp } from './route-app-preload.js';

function preloadLinks(): {
  href: string;
  as: string;
  crossOrigin: string | null;
}[] {
  return Array.from(
    document.head.querySelectorAll('link[rel="preload"]'),
    (link) => ({
      href: link.getAttribute('href') ?? '',
      as: link.getAttribute('as') ?? '',
      crossOrigin: link.getAttribute('crossorigin'),
    }),
  );
}

describe('preloadActiveRouteApp', () => {
  const hostId = faker.string.uuid();
  const pageUrl = 'https://host.example/orders/42?tab=1';

  beforeEach(() => {
    document.head.replaceChildren();
  });

  it('should preload the remote entry of the app whose route matches the page path', () => {
    const app = anAppManifest({
      placements: [
        aRoutePlacement({
          hostId,
          route: { path: '/orders', match: 'prefix' },
        }),
      ],
    });
    const other = anAppManifest({
      placements: [aRoutePlacement({ hostId, route: { path: '/billing' } })],
    });

    preloadActiveRouteApp({
      document,
      pageUrl,
      catalog: aHostCatalog({ hostId, apps: [other, app] }),
    });

    expect(preloadLinks()).toStrictEqual([
      { href: app.remoteEntryUrl, as: 'fetch', crossOrigin: 'anonymous' },
    ]);
  });

  it('should preload the app with the longest matching route path when several routes match', () => {
    const broad = anAppManifest({
      placements: [
        aRoutePlacement({ hostId, route: { path: '/', match: 'prefix' } }),
      ],
    });
    const specific = anAppManifest({
      placements: [
        aRoutePlacement({
          hostId,
          route: { path: '/orders', match: 'prefix' },
        }),
      ],
    });

    preloadActiveRouteApp({
      document,
      pageUrl,
      catalog: aHostCatalog({ hostId, apps: [broad, specific] }),
    });

    expect(preloadLinks().map(({ href }) => href)).toStrictEqual([
      specific.remoteEntryUrl,
    ]);
  });

  it('should not preload when a full match route has more segments than the route path', () => {
    const app = anAppManifest({
      placements: [
        aRoutePlacement({ hostId, route: { path: '/orders', match: 'full' } }),
      ],
    });

    preloadActiveRouteApp({
      document,
      pageUrl,
      catalog: aHostCatalog({ hostId, apps: [app] }),
    });

    expect(preloadLinks()).toStrictEqual([]);
  });

  it('should not preload when the matching route targets another host', () => {
    const app = anAppManifest({
      placements: [
        aRoutePlacement({
          hostId: faker.string.uuid(),
          route: { path: '/orders', match: 'prefix' },
        }),
      ],
    });

    preloadActiveRouteApp({
      document,
      pageUrl,
      catalog: aHostCatalog({ hostId, apps: [app] }),
    });

    expect(preloadLinks()).toStrictEqual([]);
  });

  it('should not preload when the matching route redirects', () => {
    const app = anAppManifest({
      placements: [
        aRoutePlacement({
          hostId,
          route: { path: '/orders', match: 'prefix', redirectTo: '/billing' },
        }),
      ],
    });

    preloadActiveRouteApp({
      document,
      pageUrl,
      catalog: aHostCatalog({ hostId, apps: [app] }),
    });

    expect(preloadLinks()).toStrictEqual([]);
  });

  it('should not preload when the app only has slot placements', () => {
    const app = anAppManifest({ placements: [aSlotPlacement({ hostId })] });

    preloadActiveRouteApp({
      document,
      pageUrl,
      catalog: aHostCatalog({ hostId, apps: [app] }),
    });

    expect(preloadLinks()).toStrictEqual([]);
  });
});
