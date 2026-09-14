import { ActionIconThemeDriver } from './action-icon-theme.driver';

describe('actionIconPathsFor', () => {
  let driver: ActionIconThemeDriver;

  beforeEach(() => {
    driver = new ActionIconThemeDriver();
  });

  it('should use bright icons when the color scheme is dark', () => {
    driver.when.pathsResolved('dark');

    expect(driver.get.paths()).toStrictEqual({
      16: 'icons/columbus-bright-16.png',
      32: 'icons/columbus-bright-32.png',
    });
  });

  it('should use dark icons when the color scheme is light', () => {
    driver.when.pathsResolved('light');

    expect(driver.get.paths()).toStrictEqual({
      16: 'icons/columbus-dark-16.png',
      32: 'icons/columbus-dark-32.png',
    });
  });
});
