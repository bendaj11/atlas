import { aManifest } from '../../../../types/app.testkit';
import { OverrideVersionDropdownDriver } from './OverrideVersionDropdown.driver';

const DEPLOYED = aManifest({
  version: '1.0.0',
  buildId: 'b1',
  channel: 'production',
  supportedHosts: ['*'],
});
const NEWER = aManifest({
  version: '2.0.0',
  buildId: 'b2',
  channel: 'production',
  supportedHosts: ['*'],
});

describe('OverrideVersionDropdown', () => {
  let driver: OverrideVersionDropdownDriver;

  beforeEach(() => {
    driver = new OverrideVersionDropdownDriver();
  });

  it('should show the placeholder when there are no versions', () => {
    driver.when.rendered();

    expect(driver.get.input().placeholder).toBe('No versions found');
  });

  it('should be disabled when there are no versions', () => {
    driver.when.rendered();

    expect(driver.get.input().disabled).toBe(true);
  });

  it('should be disabled when disabled by the form', () => {
    driver.given.versions([DEPLOYED]).given.disabled(true).when.rendered();

    expect(driver.get.input().disabled).toBe(true);
  });

  it('should list a label per version when opened', async () => {
    await driver.given
      .versions([DEPLOYED, NEWER])
      .when.rendered()
      .when.opened();

    expect(driver.get.optionLabels()).toHaveLength(2);
  });

  it('should mark the deployed production version when opened', async () => {
    await driver.given
      .versions([DEPLOYED, NEWER])
      .given.deployedManifest(DEPLOYED)
      .when.rendered()
      .when.opened();

    expect(driver.get.optionHasBadge('1.0.0-b1', 'Deployed')).toBe(true);
  });

  it('should not mark other versions as deployed when opened', async () => {
    await driver.given
      .versions([DEPLOYED, NEWER])
      .given.deployedManifest(DEPLOYED)
      .when.rendered()
      .when.opened();

    expect(driver.get.optionHasBadge('2.0.0-b2', 'Deployed')).toBe(false);
  });

  it('should not select a version that does not support the host when chosen', async () => {
    const unsupported = aManifest({
      version: '3.0.0',
      buildId: 'b3',
      supportedHosts: ['other-host'],
    });

    await driver.given
      .versions([DEPLOYED, unsupported])
      .when.rendered()
      .when.optionChosen('3.0.0-b3');

    expect(driver.get.selectedValue()).toBeUndefined();
  });

  it('should emit the version key when an option is chosen', async () => {
    await driver.given
      .versions([DEPLOYED, NEWER])
      .when.rendered()
      .when.optionChosen('2.0.0-b2');

    expect(driver.get.selectedValue()).toBe('production:2.0.0:b2');
  });
});
