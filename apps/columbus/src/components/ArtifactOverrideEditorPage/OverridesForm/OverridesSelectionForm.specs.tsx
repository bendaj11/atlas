import { faker } from '@faker-js/faker';
import { OVERRIDE_TYPES, type OverrideType } from '../../../types/artifact';
import { anAppManifest } from '@atlas/testkit';
import { anArtifactOverrideOptions } from '../../../testkit/artifact.testkit';
import { OverridesSelectionFormDriver } from './OverridesSelectionForm.driver';

const NOT_CUSTOM_TYPES = ['production', 'pr'] satisfies OverrideType[];
const NOT_PRODUCTION_TYPES = ['custom', 'pr'] satisfies OverrideType[];
const NOT_PR_TYPES = ['custom', 'production'] satisfies OverrideType[];

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
      const value = faker.string.alphanumeric(8);

      driver.given.selection({ type, value }).when.rendered();

      expect(await driver.get.radio(`override-card-${type}`).isChecked()).toBe(
        true,
      );
    },
  );

  it.each(OVERRIDE_TYPES)(
    'should not check the other cards when the selection type is %s',
    async (type) => {
      const value = faker.string.alphanumeric(8);
      const others = OVERRIDE_TYPES.filter((other) => other !== type);

      driver.given.selection({ type, value }).when.rendered();

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
    driver.given
      .overrideOptions(
        anArtifactOverrideOptions({ productionArtifactVersions: [] }),
      )
      .when.rendered();

    expect(
      await driver.get.radio('override-card-production').isDisabled(),
    ).toBe(true);
  });

  it('should enable the production card when production versions exist', async () => {
    driver.given
      .overrideOptions(
        anArtifactOverrideOptions({
          productionArtifactVersions: [anAppManifest()],
        }),
      )
      .when.rendered();

    expect(
      await driver.get.radio('override-card-production').isDisabled(),
    ).toBe(false);
  });

  it('should disable the pr card when no pr versions exist', async () => {
    driver.given
      .overrideOptions(anArtifactOverrideOptions({ prArtifactVersions: [] }))
      .when.rendered();

    expect(await driver.get.radio('override-card-pr').isDisabled()).toBe(true);
  });

  it('should enable the pr card when pr versions exist', async () => {
    driver.given
      .overrideOptions(
        anArtifactOverrideOptions({ prArtifactVersions: [anAppManifest()] }),
      )
      .when.rendered();

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

  describe('when the selection is not a custom url', () => {
    beforeEach(() => {
      driver.given
        .selection({
          type: faker.helpers.arrayElement(NOT_CUSTOM_TYPES),
          value: faker.string.alphanumeric(8),
        })
        .when.rendered();
    });

    it('should show an empty custom url when rendered', async () => {
      expect(await driver.get.customUrlInput().getValue()).toBe('');
    });

    it('should disable the custom url input when rendered', async () => {
      expect(await driver.get.customUrlInput().isDisabled()).toBe(true);
    });
  });

  describe('when production versions exist', () => {
    beforeEach(() => {
      driver.given.overrideOptions(
        anArtifactOverrideOptions({
          productionArtifactVersions: [anAppManifest()],
        }),
      );
    });

    it('should enable the production dropdown when the selection type is production', async () => {
      driver.given
        .selection({ type: 'production', value: faker.string.alphanumeric(8) })
        .when.rendered();

      expect(
        await driver.get
          .dropdown('override-version-production')
          .inputDriver.isDisabled(),
      ).toBe(false);
    });

    it('should disable the production dropdown when the selection type is not production', async () => {
      driver.given
        .selection({
          type: faker.helpers.arrayElement(NOT_PRODUCTION_TYPES),
          value: faker.string.alphanumeric(8),
        })
        .when.rendered();

      expect(
        await driver.get
          .dropdown('override-version-production')
          .inputDriver.isDisabled(),
      ).toBe(true);
    });
  });

  describe('when pr versions exist', () => {
    beforeEach(() => {
      driver.given.overrideOptions(
        anArtifactOverrideOptions({ prArtifactVersions: [anAppManifest()] }),
      );
    });

    it('should enable the pr dropdown when the selection type is pr', async () => {
      driver.given
        .selection({ type: 'pr', value: faker.string.alphanumeric(8) })
        .when.rendered();

      expect(
        await driver.get
          .dropdown('override-version-pr')
          .inputDriver.isDisabled(),
      ).toBe(false);
    });

    it('should disable the pr dropdown when the selection type is not pr', async () => {
      driver.given
        .selection({
          type: faker.helpers.arrayElement(NOT_PR_TYPES),
          value: faker.string.alphanumeric(8),
        })
        .when.rendered();

      expect(
        await driver.get
          .dropdown('override-version-pr')
          .inputDriver.isDisabled(),
      ).toBe(true);
    });
  });

  describe('when production and pr versions exist', () => {
    beforeEach(() => {
      driver.given.overrideOptions(
        anArtifactOverrideOptions({
          productionArtifactVersions: [anAppManifest()],
          prArtifactVersions: [anAppManifest()],
        }),
      );
    });

    it.each(OVERRIDE_TYPES)(
      'should call onChange with empty selection of type %s when its card is selected',
      async (type) => {
        const current = faker.helpers.arrayElement(
          OVERRIDE_TYPES.filter((other) => other !== type),
        );
        const value = faker.string.alphanumeric(8);

        driver.given.selection({ type: current, value }).when.rendered();

        await driver.when.overrideTypeSelected(type);

        expect(driver.get.changeMock()).toHaveBeenCalledWith({
          type,
          value: '',
        });
      },
    );
  });

  it('should call onChange with production selection of chosen version key when the selection type is production and a production version that supports the host is chosen', async () => {
    const hostId = faker.string.uuid();
    const artifactVersion = anAppManifest({ supportedHosts: [hostId] });

    driver.given
      .selection({ type: 'production', value: faker.string.alphanumeric(8) })
      .given.hostId(hostId)
      .given.overrideOptions(
        anArtifactOverrideOptions({
          productionArtifactVersions: [artifactVersion],
        }),
      )
      .when.rendered();

    await driver.when.productionArtifactVersionChosen(artifactVersion);

    expect(driver.get.changeMock()).toHaveBeenCalledWith({
      type: 'production',
      value: `${artifactVersion.channel}:${artifactVersion.version}:${artifactVersion.buildId}`,
    });
  });

  it('should call onChange with pr selection of chosen version key when the selection type is pr and a pr version that supports the host is chosen', async () => {
    const hostId = faker.string.uuid();
    const artifactVersion = anAppManifest({ supportedHosts: [hostId] });

    driver.given
      .selection({ type: 'pr', value: faker.string.alphanumeric(8) })
      .given.hostId(hostId)
      .given.overrideOptions(
        anArtifactOverrideOptions({ prArtifactVersions: [artifactVersion] }),
      )
      .when.rendered();

    await driver.when.prArtifactVersionChosen(artifactVersion);

    expect(driver.get.changeMock()).toHaveBeenCalledWith({
      type: 'pr',
      value: `${artifactVersion.channel}:${artifactVersion.version}:${artifactVersion.buildId}`,
    });
  });
});
