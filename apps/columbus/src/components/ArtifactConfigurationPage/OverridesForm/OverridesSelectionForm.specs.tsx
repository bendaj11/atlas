import { faker } from '@faker-js/faker';
import type { OverrideType } from '../../../types/artifact';
import { anAppArtifactVersion } from '../../../types/artifact-version.testkit';
import { OverridesSelectionFormDriver } from './OverridesSelectionForm.driver';

const OVERRIDE_TYPES: OverrideType[] = ['custom', 'production', 'pr'];

describe('OverridesSelectionForm', () => {
  let driver: OverridesSelectionFormDriver;

  beforeEach(() => {
    driver = new OverridesSelectionFormDriver();
  });

  it('should enable the custom card when rendered', async () => {
    driver.when.rendered();

    expect(await driver.get.radio('override-card-custom').isDisabled()).toBe(
      false,
    );
  });

  it.each(OVERRIDE_TYPES)(
    'should check the matching card when the selection type is %s',
    async (type) => {
      driver.given.selection({ type, value: '' }).when.rendered();

      expect(await driver.get.radio(`override-card-${type}`).isChecked()).toBe(
        true,
      );
    },
  );

  it.each(OVERRIDE_TYPES)(
    'should not check the other cards when the selection type is %s',
    async (type) => {
      const others = OVERRIDE_TYPES.filter((other) => other !== type);

      driver.given.selection({ type, value: '' }).when.rendered();

      expect(
        await Promise.all(
          others.map((other) =>
            driver.get.radio(`override-card-${other}`).isChecked(),
          ),
        ),
      ).toEqual([false, false]);
    },
  );

  it('should disable the production card when no production versions exist', async () => {
    driver.given.productionArtifactVersions([]).when.rendered();

    expect(
      await driver.get.radio('override-card-production').isDisabled(),
    ).toBe(true);
  });

  it('should enable the production card when production versions exist', async () => {
    driver.given
      .productionArtifactVersions([anAppArtifactVersion()])
      .when.rendered();

    expect(
      await driver.get.radio('override-card-production').isDisabled(),
    ).toBe(false);
  });

  it('should disable the pr card when no pr versions exist', async () => {
    driver.given.prArtifactVersions([]).when.rendered();

    expect(await driver.get.radio('override-card-pr').isDisabled()).toBe(true);
  });

  it('should enable the pr card when pr versions exist', async () => {
    driver.given.prArtifactVersions([anAppArtifactVersion()]).when.rendered();

    expect(await driver.get.radio('override-card-pr').isDisabled()).toBe(false);
  });

  describe('when the selection is a custom url', () => {
    const url = faker.internet.url();

    beforeEach(() => {
      driver.given.selection({ type: 'custom', value: url }).when.rendered();
    });

    it('should show the custom url when rendered', async () => {
      expect(await driver.get.customUrlInput().getValue()).toBe(url);
    });

    it('should enable the custom url input when rendered', async () => {
      expect(await driver.get.customUrlInput().isDisabled()).toBe(false);
    });

    it('should call onChange with custom selection of entered url when a custom url is entered', async () => {
      const entered = faker.internet.url();

      await driver.when.customUrlEntered(entered);

      expect(driver.get.changeMock()).toHaveBeenCalledWith({
        type: 'custom',
        value: entered,
      });
    });
  });

  it.each(['production', 'pr'] satisfies OverrideType[])(
    'should disable the custom url input when the selection type is %s',
    async (type) => {
      driver.given.selection({ type, value: '' }).when.rendered();

      expect(await driver.get.customUrlInput().isDisabled()).toBe(true);
    },
  );

  it.each(['custom', 'pr'] satisfies OverrideType[])(
    'should disable the production dropdown when the selection type is %s',
    async (type) => {
      driver.given
        .selection({ type, value: '' })
        .given.productionArtifactVersions([anAppArtifactVersion()])
        .when.rendered();

      expect(
        await driver.get
          .dropdown('override-version-production')
          .inputDriver.isDisabled(),
      ).toBe(true);
    },
  );

  it.each(['custom', 'production'] satisfies OverrideType[])(
    'should disable the pr dropdown when the selection type is %s',
    async (type) => {
      driver.given
        .selection({ type, value: '' })
        .given.prArtifactVersions([anAppArtifactVersion()])
        .when.rendered();

      expect(
        await driver.get
          .dropdown('override-version-pr')
          .inputDriver.isDisabled(),
      ).toBe(true);
    },
  );

  describe('when production and pr versions exist', () => {
    beforeEach(() => {
      driver.given
        .productionArtifactVersions([anAppArtifactVersion()])
        .given.prArtifactVersions([anAppArtifactVersion()]);
    });

    it.each(OVERRIDE_TYPES)(
      'should call onChange with empty %s selection when its card is selected',
      async (type) => {
        const current = faker.helpers.arrayElement(
          OVERRIDE_TYPES.filter((other) => other !== type),
        );

        driver.given.selection({ type: current, value: '' }).when.rendered();

        await driver.when.typeSelected(type);

        expect(driver.get.changeMock()).toHaveBeenCalledWith({
          type,
          value: '',
        });
      },
    );
  });

  describe('when the selection is production and a production version supports the host', () => {
    const hostId = faker.string.uuid();
    const version = anAppArtifactVersion({ supportedHosts: [hostId] });

    beforeEach(() => {
      driver.given
        .selection({ type: 'production', value: '' })
        .given.hostId(hostId)
        .given.productionArtifactVersions([version])
        .when.rendered();
    });

    it('should enable the production dropdown when rendered', async () => {
      expect(
        await driver.get
          .dropdown('override-version-production')
          .inputDriver.isDisabled(),
      ).toBe(false);
    });

    it('should call onChange with production selection of chosen version key when the production version is chosen', async () => {
      await driver.when.productionVersionChosen(version);

      expect(driver.get.changeMock()).toHaveBeenCalledWith({
        type: 'production',
        value: `${version.channel}:${version.version}:${version.buildId}`,
      });
    });
  });

  describe('when the selection is pr and a pr version supports the host', () => {
    const hostId = faker.string.uuid();
    const version = anAppArtifactVersion({ supportedHosts: [hostId] });

    beforeEach(() => {
      driver.given
        .selection({ type: 'pr', value: '' })
        .given.hostId(hostId)
        .given.prArtifactVersions([version])
        .when.rendered();
    });

    it('should enable the pr dropdown when rendered', async () => {
      expect(
        await driver.get
          .dropdown('override-version-pr')
          .inputDriver.isDisabled(),
      ).toBe(false);
    });

    it('should call onChange with pr selection of chosen version key when the pr version is chosen', async () => {
      await driver.when.prVersionChosen(version);

      expect(driver.get.changeMock()).toHaveBeenCalledWith({
        type: 'pr',
        value: `${version.channel}:${version.version}:${version.buildId}`,
      });
    });
  });
});
