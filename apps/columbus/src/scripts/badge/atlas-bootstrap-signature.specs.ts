/** @jest-environment jsdom */

import { beforeEach, describe, expect, it } from '@jest/globals';
import { AtlasBootstrapSignatureDriver } from './atlas-bootstrap-signature.driver.js';

describe('Atlas bootstrap signature', () => {
  let driver: AtlasBootstrapSignatureDriver;

  beforeEach(() => {
    driver = new AtlasBootstrapSignatureDriver();
  });

  it('should identify an Atlas bootstrap page when required bootstrap elements exist', () => {
    driver.given.atlasBootstrapPage();

    expect(driver.get.isAtlasBootstrapPage()).toBe(true);
  });

  it('should not identify a page when Atlas host root is missing', () => {
    driver.given.loaderScriptOnly();

    expect(driver.get.isAtlasBootstrapPage()).toBe(false);
  });

  it('should not identify a page when Atlas loader script is missing', () => {
    driver.given.hostRootOnly();

    expect(driver.get.isAtlasBootstrapPage()).toBe(false);
  });
});
