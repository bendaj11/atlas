import { ArtifactsOverridesPageDriver } from './ArtifactsOverridesPage.driver';

describe('ArtifactsOverridesPage', () => {
  let driver: ArtifactsOverridesPageDriver;

  beforeEach(() => {
    driver = new ArtifactsOverridesPageDriver();
  });

  it('should show the failure reason when host failed to load', () => {
    driver.given.hostStatus('ERROR', 'No Atlas tab.').when.rendered();

    expect(driver.get.text('No Atlas tab.')).not.toBeNull();
  });

  it('should reload the host when refresh is clicked after a failure', async () => {
    await driver.given
      .hostStatus('ERROR', 'No Atlas tab.')
      .when.rendered()
      .when.refreshClicked();

    expect(driver.get.loadHostCount()).toBe(1);
  });

  it('should show the table when host is loaded', () => {
    driver.when.rendered();

    expect(driver.get.text('artifacts table')).not.toBeNull();
  });

  it.each(['RESTORING', 'LOADING', 'ERROR'] as const)(
    'should hide the table when host status is %s',
    (status) => {
      driver.given.hostStatus(status).when.rendered();

      expect(driver.get.text('artifacts table')).toBeNull();
    },
  );

  it('should clear all overrides when clear is clicked and overrides exist', async () => {
    await driver.given.hasOverrides(true).when.rendered().when.clearClicked();

    expect(driver.get.clearCount()).toBe(1);
  });

  it('should not clear when there are no overrides', async () => {
    await driver.when.rendered().when.clearClicked();

    expect(driver.get.clearCount()).toBe(0);
  });

  it('should not clear when actions are disabled', async () => {
    await driver.given
      .hasOverrides(true)
      .given.actionsDisabled(true)
      .when.rendered()
      .when.clearClicked();

    expect(driver.get.clearCount()).toBe(0);
  });
});
