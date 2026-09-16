import { faker } from '@faker-js/faker';
import { NavigationPathsDriver } from './navigation-paths.driver.js';

const RELATIVE_TARGETS = ['details/42', '/details/42'];
const EXTERNAL_URLS = ['https://example.com', 'http://example.com/x'];

describe('scopePath', () => {
  let driver: NavigationPathsDriver;

  beforeEach(() => {
    driver = new NavigationPathsDriver();
  });

  describe('when the app path is /catalog', () => {
    beforeEach(() => {
      driver.given.path('/catalog');
    });

    it.each(RELATIVE_TARGETS)(
      'should prefix the app path when navigating to %s',
      (to) => {
        driver.when.pathScoped(to);

        expect(driver.get.result()).toBe('/catalog/details/42');
      },
    );

    it('should keep the target when it is already inside the app path', () => {
      driver.when.pathScoped('/catalog/details/42');

      expect(driver.get.result()).toBe('/catalog/details/42');
    });

    it('should keep the target when it is the app path with a query', () => {
      driver.when.pathScoped('/catalog?tab=open');

      expect(driver.get.result()).toBe('/catalog?tab=open');
    });

    it('should prefix the app path when the target only shares a path prefix', () => {
      driver.when.pathScoped('/catalogue/details');

      expect(driver.get.result()).toBe('/catalog/catalogue/details');
    });

    it('should return the app path when navigating to an empty target', () => {
      driver.when.pathScoped('');

      expect(driver.get.result()).toBe('/catalog');
    });

    it('should append the query to the app path when navigating to a query-only target', () => {
      driver.when.pathScoped('?tab=open');

      expect(driver.get.result()).toBe('/catalog?tab=open');
    });

    it.each(EXTERNAL_URLS)(
      'should throw ATLAS_EXTERNAL_SCOPED_NAVIGATION when navigating to %s',
      (to) => {
        expect(() => driver.when.pathScoped(to)).toThrow(
          expect.objectContaining({ code: 'ATLAS_EXTERNAL_SCOPED_NAVIGATION' }),
        );
      },
    );
  });

  describe('when the app path is the root', () => {
    beforeEach(() => {
      driver.given.path('/');
    });

    it('should return a single-slash path when navigating to a relative target', () => {
      driver.when.pathScoped('details/42');

      expect(driver.get.result()).toBe('/details/42');
    });

    it('should keep an absolute target when navigating', () => {
      driver.when.pathScoped('/details/42');

      expect(driver.get.result()).toBe('/details/42');
    });
  });
});

describe('normalizePath', () => {
  let driver: NavigationPathsDriver;

  beforeEach(() => {
    driver = new NavigationPathsDriver();
  });

  it('should add a leading slash when the path has none', () => {
    driver.given.path('catalog/').when.pathNormalized();

    expect(driver.get.result()).toBe('/catalog');
  });

  it('should strip trailing slashes when the path ends with them', () => {
    driver.given.path('/catalog//').when.pathNormalized();

    expect(driver.get.result()).toBe('/catalog');
  });

  it('should return the root when the path is only slashes', () => {
    driver.given.path('//').when.pathNormalized();

    expect(driver.get.result()).toBe('/');
  });
});

describe('toInnerPath', () => {
  let driver: NavigationPathsDriver;

  beforeEach(() => {
    driver = new NavigationPathsDriver();
  });

  it('should return the pathname unchanged when the app path is the root', () => {
    driver.given.path('/').when.innerPathRead('/orders/42');

    expect(driver.get.result()).toBe('/orders/42');
  });

  describe('when the app path is /catalog', () => {
    beforeEach(() => {
      driver.given.path('/catalog');
    });

    it('should return the root when the pathname equals the app path', () => {
      driver.when.innerPathRead('/catalog');

      expect(driver.get.result()).toBe('/');
    });

    it('should strip the app path when the pathname is below it', () => {
      driver.when.innerPathRead('/catalog/orders/42');

      expect(driver.get.result()).toBe('/orders/42');
    });

    it('should return the root when the pathname is outside the app path', () => {
      driver.when.innerPathRead('/catalogue/orders');

      expect(driver.get.result()).toBe('/');
    });
  });
});

describe('parseQuery', () => {
  let driver: NavigationPathsDriver;

  beforeEach(() => {
    driver = new NavigationPathsDriver();
  });

  it('should return single values and repeated keys as arrays when the search has both', () => {
    driver.when.queryParsed('?tab=open&tag=a&tag=b');

    expect(driver.get.result()).toEqual({ tab: 'open', tag: ['a', 'b'] });
  });

  it('should return an empty object when the search is empty', () => {
    driver.when.queryParsed('');

    expect(driver.get.result()).toEqual({});
  });
});

describe('matchRoutePattern', () => {
  let driver: NavigationPathsDriver;

  beforeEach(() => {
    driver = new NavigationPathsDriver();
  });

  it('should return decoded params when the pathname matches the pattern', () => {
    driver.when.patternMatched('orders/:id', '/orders/a%20b');

    expect(driver.get.result()).toEqual({ id: 'a b' });
  });

  it('should return undefined when a static segment differs', () => {
    driver.when.patternMatched('orders/:id', '/invoices/42');

    expect(driver.get.result()).toBeUndefined();
  });

  it('should return undefined when the pathname has more segments than the pattern', () => {
    driver.when.patternMatched('orders/:id', '/orders/42/items');

    expect(driver.get.result()).toBeUndefined();
  });

  it('should return undefined when the pathname has fewer segments than the pattern', () => {
    driver.when.patternMatched('orders/:id', '/orders');

    expect(driver.get.result()).toBeUndefined();
  });

  it('should capture the rest of the pathname as wildcard when the pattern ends with a star', () => {
    driver.when.patternMatched('files/*', '/files/docs/a%2Fb.txt');

    expect(driver.get.result()).toEqual({ wildcard: 'docs/a/b.txt' });
  });
});

describe('goThroughHistory', () => {
  let driver: NavigationPathsDriver;

  beforeEach(() => {
    driver = new NavigationPathsDriver();
  });

  it('should call go with the delta when the navigation supports go', () => {
    const delta = faker.number.int({ min: -5, max: 5 });

    driver.when.historyMovedWithGo(delta);

    expect(driver.get.goMock()).toHaveBeenCalledWith(delta);
  });

  it('should call back when the navigation lacks go and the delta is -1', () => {
    driver.when.historyMovedWithoutGo(-1);

    expect(driver.get.backMock()).toHaveBeenCalledTimes(1);
  });

  it('should not call back when the navigation lacks go and the delta is not -1', () => {
    driver.when.historyMovedWithoutGo(-2);

    expect(driver.get.backMock()).not.toHaveBeenCalled();
  });
});
