/** @jest-environment jsdom */

import { ShadowStylesDriver } from './shadow-styles.driver.js';

describe('adaptShadowStyleSheet', () => {
  let driver: ShadowStylesDriver;

  beforeEach(() => {
    driver = new ShadowStylesDriver();
  });

  it('should replace root selectors when the stylesheet contains style rules', () => {
    driver.given
      .cssText(':root { color: red; } .title { color: blue; }')
      .when.adapted();

    expect(driver.get.selectorTexts()).toEqual([':host', '.title']);
  });

  it('should adapt nested rule selectors when styles use media queries', () => {
    driver.given
      .cssText('@media (min-width: 0px) { :root { color: red; } }')
      .when.adapted();

    expect(driver.get.adaptedSelectors()).toEqual([':root']);
  });

  it('should skip rules without selectors when the stylesheet contains keyframes or font faces', () => {
    driver.given
      .cssText(
        '@keyframes fade { from { opacity: 0; } } @font-face { font-family: X; }',
      )
      .when.adapted();

    expect(driver.get.adaptedSelectors()).toEqual([]);
  });

  it('should propagate the access failure when stylesheet rules are inaccessible', () => {
    driver.given.inaccessibleRules(new Error('CORS denied'));

    expect(() => driver.when.adapted()).toThrow('CORS denied');
  });
});
