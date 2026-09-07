import { beforeEach, describe, expect, it } from '@jest/globals';
import { AngularStyleHostDriver } from './angular-style-host.driver.js';

describe('attachAngularComponentStyles', () => {
  let driver: AngularStyleHostDriver;

  beforeEach(() => {
    driver = new AngularStyleHostDriver();
  });

  it('should attach component styles to the shadow root when Atlas isolates an app', () => {
    driver.given.styleTarget('shadow-root');
    driver.when.attachComponentStyles();

    expect(driver.get.stylesAreAttachedOnlyToShadowRoot()).toBe(true);
  });

  it('should preserve document styles when Atlas uses shared DOM', () => {
    driver.given.styleTarget('document-head');
    driver.when.attachComponentStyles();

    expect(driver.get.stylesRemainAtDocumentHead()).toBe(true);
  });
  it('should attach unscoped component styles to shadow root when Atlas isolates an app', () => {
    driver.when.attachAndAddUnscopedComponentStyle();

    expect(driver.get.unscopedStylesAreAttachedOnlyToShadowRoot()).toBe(true);
  });
});
