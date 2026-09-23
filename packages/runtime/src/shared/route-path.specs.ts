import { faker } from '@faker-js/faker';
import { anAppManifest, aRoutePlacement } from '@atlas/testkit';
import {
  doesRouteMatchPathname,
  findDefaultRoutePathOfManifest,
  normalizeRoutePath,
} from './route-path.js';

describe('doesRouteMatchPathname', () => {
  it.each([
    ['/orders', '/orders', true],
    ['/orders', '/orders/42', true],
    ['/orders/', '/orders', true],
    ['/orders', '/order', false],
    ['/', '/anything', true],
    ['/users/:id', '/users/42', true],
    ['/users/:id', '/users', false],
    ['/files/*', '/files/a/b/c', true],
  ])(
    'should return %s for pathname %s as %s when the route has prefix matching',
    (path, pathname, expected) => {
      expect(doesRouteMatchPathname({ path }, pathname)).toBe(expected);
    },
  );

  it.each([
    ['/catalog', '/catalog', true],
    ['/catalog', '/catalog/x', false],
    ['/', '/', true],
    ['/', '/x', false],
  ])(
    'should return %s for pathname %s as %s when the route requires a full match',
    (path, pathname, expected) => {
      expect(doesRouteMatchPathname({ path, match: 'full' }, pathname)).toBe(
        expected,
      );
    },
  );
});

describe('normalizeRoutePath', () => {
  it.each([
    ['/', '/'],
    ['/orders/', '/orders'],
    ['/orders///', '/orders'],
    ['/orders', '/orders'],
  ])('should normalize %s to %s when called', (path, expected) => {
    expect(normalizeRoutePath(path)).toBe(expected);
  });
});

describe('findDefaultRoutePathOfManifest', () => {
  it('should return the first route placement path when the manifest declares routes', () => {
    const path = `/${faker.word.noun()}`;
    const manifest = anAppManifest({
      placements: [aRoutePlacement({ route: { path } })],
    });

    expect(findDefaultRoutePathOfManifest(manifest)).toBe(path);
  });

  it('should return a path derived from the id when the manifest declares no routes', () => {
    const manifest = anAppManifest({ placements: [] });

    expect(findDefaultRoutePathOfManifest(manifest)).toBe(`/${manifest.id}`);
  });
});
