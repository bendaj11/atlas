import { ParseQueryDriver } from './parse-query.driver.js';

describe('parseQuery', () => {
  let driver: ParseQueryDriver;

  beforeEach(() => {
    driver = new ParseQueryDriver();
  });

  it('should return single values and repeated keys as arrays when the search has both', () => {
    driver.when.queryParsed('?tab=open&tag=a&tag=b');

    expect(driver.get.result()).toEqual({ tab: 'open', tag: ['a', 'b'] });
  });

  it('should collect every value when a key repeats three times', () => {
    driver.when.queryParsed('?tag=a&tag=b&tag=c');

    expect(driver.get.result()).toEqual({ tag: ['a', 'b', 'c'] });
  });

  it('should return an empty object when the search is empty', () => {
    driver.when.queryParsed('');

    expect(driver.get.result()).toEqual({});
  });
});
