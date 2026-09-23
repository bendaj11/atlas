import { PathConversionsDriver } from './path-conversions.driver.js';

describe('normalizePath', () => {
  let driver: PathConversionsDriver;

  beforeEach(() => {
    driver = new PathConversionsDriver();
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

describe('convertHostPathToInnerPath', () => {
  let driver: PathConversionsDriver;

  beforeEach(() => {
    driver = new PathConversionsDriver();
  });

  it('should return the pathname unchanged when the app path is the root', () => {
    driver.given.path('/').when.innerPathRead('/orders/42');

    expect(driver.get.result()).toBe('/orders/42');
  });

  it('should return the root when the app path is the root and the pathname is empty', () => {
    driver.given.path('/').when.innerPathRead('');

    expect(driver.get.result()).toBe('/');
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
