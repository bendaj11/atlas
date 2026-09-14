import { aManifest } from '../../../types/app.testkit';
import { OverridesSelectionFormDriver } from './OverridesSelectionForm.driver';

const PRODUCTION = aManifest({
  version: '2.0.0',
  buildId: 'b2',
  channel: 'production',
  supportedHosts: ['*'],
});
const PREVIEW = aManifest({
  channel: 'pr',
  prNumber: 42,
  buildId: 'pr42',
  supportedHosts: ['*'],
});

describe('OverridesSelectionForm', () => {
  let driver: OverridesSelectionFormDriver;

  beforeEach(() => {
    driver = new OverridesSelectionFormDriver();
  });

  it.each(['custom', 'production', 'pr'] as const)(
    'should check the matching card when draft type is %s',
    (type) => {
      const titles = {
        custom: 'Custom URL',
        production: 'Production',
        pr: 'PR Preview',
      };

      driver.given
        .draft({ type })
        .given.productionOptions([PRODUCTION])
        .given.prOptions([PREVIEW])
        .when.rendered();

      expect(driver.get.radio(titles[type]).checked).toBe(true);
    },
  );

  it('should switch draft type when a card is chosen', async () => {
    await driver.given
      .productionOptions([PRODUCTION])
      .when.rendered()
      .when.typeChosen('Production');

    expect(driver.get.lastDraftChange()).toEqual({ type: 'production' });
  });

  it('should not switch to production when no production versions exist', async () => {
    await driver.when.rendered().when.typeChosen('Production');

    expect(driver.get.lastDraftChange()).toBeUndefined();
  });

  it('should not switch to pr when no pr versions exist', async () => {
    await driver.when.rendered().when.typeChosen('PR Preview');

    expect(driver.get.lastDraftChange()).toBeUndefined();
  });

  it('should update the custom url when typed', async () => {
    await driver.when.rendered().when.customUrlTyped('h');

    expect(driver.get.lastDraftChange()).toEqual({ customUrl: 'h' });
  });

  it('should disable the custom url input when another type is selected', () => {
    driver.given.draft({ type: 'production' }).when.rendered();

    expect(driver.get.customUrlInput().disabled).toBe(true);
  });

  it('should update the production key when a production version is chosen', async () => {
    await driver.given
      .draft({ type: 'production' })
      .given.productionOptions([PRODUCTION])
      .when.rendered()
      .when.versionChosen('2.0.0-b2');

    expect(driver.get.lastDraftChange()).toEqual({
      productionKey: 'production:2.0.0:b2',
    });
  });
});
