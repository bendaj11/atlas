/** @jest-environment jsdom */

import { AngularStyleHostDriver } from './angular-style-host.driver.js';

describe('attachAngularComponentStyles', () => {
  let driver: AngularStyleHostDriver;

  beforeEach(() => {
    driver = new AngularStyleHostDriver();
  });

  describe('when the style target is a shadow root', () => {
    beforeEach(() => {
      driver.given.styleTarget('shadow-root').when.componentStylesAttached();
    });

    it('should remove the document head from the style host when styles are attached', () => {
      expect(driver.get.removeHostMock()).toHaveBeenCalledWith(
        driver.get.documentHead(),
      );
    });

    it('should add the shadow root to the style host when styles are attached', () => {
      expect(driver.get.addHostMock()).toHaveBeenCalledWith(
        driver.get.shadowRoot(),
      );
    });
  });

  it('should leave the style host untouched when the style target is the document head', () => {
    driver.given.styleTarget('document-head').when.componentStylesAttached();

    expect(driver.get.addHostMock()).not.toHaveBeenCalled();
  });

  it('should leave the style host untouched when the document has no head', () => {
    driver.given
      .styleTarget('shadow-root')
      .given.documentHead('missing')
      .when.componentStylesAttached();

    expect(driver.get.addHostMock()).not.toHaveBeenCalled();
  });
});
