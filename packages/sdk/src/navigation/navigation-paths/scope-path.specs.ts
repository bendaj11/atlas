import { ScopePathDriver } from './scope-path.driver.js';

const RELATIVE_TARGETS = ['details/42', '/details/42'];
const EXTERNAL_URLS = ['https://example.com', 'http://example.com/x'];

describe('scopePath', () => {
  let driver: ScopePathDriver;

  beforeEach(() => {
    driver = new ScopePathDriver();
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
