import { beforeEach, describe, expect, it } from '@jest/globals';
import { ShadowStylesDriver } from './shadow-styles.driver.js';

describe('shadow stylesheet adaptation', () => {
  let driver: ShadowStylesDriver;

  beforeEach(() => {
    driver = new ShadowStylesDriver();
  });

  it('should adapt root selectors when a stylesheet contains style rules', () => {
    driver.given.rules([{ selectorText: ':root' }]);
    driver.when.adapt();
    expect(driver.get.rules()).toEqual([{ selectorText: ':host' }]);
  });

  it('should adapt nested rules when styles use layers or media queries', () => {
    driver.given.rules([
      { cssRules: [{ cssRules: [{ selectorText: ':root' }] }] },
    ]);
    driver.when.adapt();
    expect(driver.get.selectors()).toEqual([':root']);
  });

  it('should adapt imported styles when a stylesheet imports a library', () => {
    driver.given.rules([
      { styleSheet: { cssRules: [{ selectorText: ':root' }] } },
    ]);
    driver.when.adapt();
    expect(driver.get.selectors()).toEqual([':root']);
  });

  it('should skip unrelated rules when a stylesheet contains keyframes or font faces', () => {
    driver.given.rules([{ cssRules: [{ keyText: 'from' }] }, { style: {} }]);
    driver.when.adapt();
    expect(driver.get.selectors()).toEqual([]);
  });

  it('should propagate access failures when stylesheet rules are inaccessible', () => {
    driver.given.inaccessible(new Error('CORS denied'));
    expect(() => driver.when.adapt()).toThrow('CORS denied');
  });
});
