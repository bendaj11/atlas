/** @jest-environment jsdom */

import { UseAtlasStyleTargetDriver } from './use-atlas-style-target.driver.js';

describe('useAtlasStyleTarget', () => {
  let driver: UseAtlasStyleTargetDriver;

  beforeEach(() => {
    driver = new UseAtlasStyleTargetDriver();
  });

  it('should provide the style target when rendered below AtlasStyleTargetContext', () => {
    driver.when.rendered();

    expect(driver.get.status()).toBe('available');
  });

  it('should throw ATLAS_STYLE_TARGET_MISSING when rendered outside an Atlas mount', () => {
    expect(() => driver.when.renderedWithoutProvider()).toThrow(
      expect.objectContaining({ code: 'ATLAS_STYLE_TARGET_MISSING' }),
    );
  });
});
