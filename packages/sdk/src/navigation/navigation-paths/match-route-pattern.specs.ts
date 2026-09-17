import { MatchRoutePatternDriver } from './match-route-pattern.driver.js';

describe('matchRoutePattern', () => {
  let driver: MatchRoutePatternDriver;

  beforeEach(() => {
    driver = new MatchRoutePatternDriver();
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
