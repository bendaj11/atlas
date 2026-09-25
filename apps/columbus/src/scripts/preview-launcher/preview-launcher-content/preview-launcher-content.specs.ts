import { faker } from '@faker-js/faker';
import { PreviewLauncherContentDriver } from './preview-launcher-content.driver';

describe('preview launcher content script', () => {
  let driver: PreviewLauncherContentDriver;

  beforeEach(() => {
    driver = new PreviewLauncherContentDriver();
  });

  describe('when the page is the preview launcher', () => {
    beforeEach(async () => {
      driver.given.pagePath(
        `/atlas.open?previewUrl=${encodeURIComponent(faker.internet.url())}`,
      );

      await driver.when.started();
    });

    it('should mark the launcher as handled when started', () => {
      expect(driver.get.launcherMarked()).toBe(true);
    });

    it('should ask the background to focus the preview when started', () => {
      expect(driver.get.runtimeMessage()).toHaveBeenCalledWith({
        type: 'atlas.focus-preview',
      });
    });
  });

  describe('when the page is not the preview launcher', () => {
    beforeEach(async () => {
      driver.given.pagePath(`/${faker.lorem.word()}`);

      await driver.when.started();
    });

    it('should not mark the page when started', () => {
      expect(driver.get.launcherMarked()).toBe(false);
    });

    it('should not message the background when started', () => {
      expect(driver.get.runtimeMessage()).not.toHaveBeenCalled();
    });
  });
});
