import { RoutePatternDriver } from './route-pattern.driver.js';

const VALID_PATTERNS = [
  '/',
  '/orders',
  '/orders/:id',
  '/orders/:id/items',
  '/files/*',
  '/a-b_c.d',
];
const INVALID_PATTERNS = [
  'orders',
  '/orders?tab=1',
  '/orders#top',
  '/orders//items',
  '/*/orders',
  '/:1id',
  '/:',
];

describe('isRoutePattern', () => {
  let driver: RoutePatternDriver;

  beforeEach(() => {
    driver = new RoutePatternDriver();
  });

  it.each(VALID_PATTERNS)('should accept "%s" when checked', (value) => {
    driver.when.checked(value);

    expect(driver.get.valid()).toBe(true);
  });

  it.each(INVALID_PATTERNS)('should reject "%s" when checked', (value) => {
    driver.when.checked(value);

    expect(driver.get.valid()).toBe(false);
  });
});

describe('normalizeRoutePath', () => {
  let driver: RoutePatternDriver;

  beforeEach(() => {
    driver = new RoutePatternDriver();
  });

  it.each([
    ['/', '/'],
    ['/orders', '/orders'],
    ['/orders/', '/orders'],
    ['/orders///', '/orders'],
  ])('should normalize "%s" to "%s" when normalized', (value, expected) => {
    driver.when.normalized(value);

    expect(driver.get.normalized()).toBe(expected);
  });
});
