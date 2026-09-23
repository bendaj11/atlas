/** @jest-environment jsdom */

import { AngularLoadingRendererDriver } from './angular-loading-renderer.driver.js';

describe('createAngularLoadingRenderer', () => {
  let driver: AngularLoadingRendererDriver;

  beforeEach(async () => {
    driver = new AngularLoadingRendererDriver();

    await driver.when.rendererCreated();
  });

  it('should render the loading component into the container when loading starts', () => {
    driver.when.loadingShown();

    expect(driver.get.containerHtml()).toContain('Widget loading');
  });

  it('should remove the loading component from the container when loading ends', () => {
    driver.when.loadingShown();
    driver.when.loadingHidden();

    expect(driver.get.containerHtml()).toBe('');
  });
});
