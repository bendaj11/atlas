import { faker } from '@faker-js/faker';
import { anAppManifest } from '@atlas/testkit';
import type { OverrideType } from '../../../../types/artifact';
import { anArtifactTableRow } from '../../../../testkit/artifact.testkit';
import { ArtifactOverrideVersionDriver } from './ArtifactOverrideVersion.driver';

const OVERRIDE_TYPE_LABELS: [OverrideType, string][] = [
  ['custom', 'Custom URL override'],
  ['pr', 'PR / MR preview override'],
  ['production', 'Other release override'],
];

describe('ArtifactOverrideVersion', () => {
  let driver: ArtifactOverrideVersionDriver;

  beforeEach(() => {
    driver = new ArtifactOverrideVersionDriver();
  });

  it('should show the source description when override is enabled', async () => {
    const sourceDescription = faker.lorem.words();

    driver.given
      .artifact(
        anArtifactTableRow({ overrideEnabled: true, sourceDescription }),
      )
      .when.rendered();

    expect(await driver.get.version().getText()).toBe(sourceDescription);
  });

  it('should mark version skin error when artifact has a load error', async () => {
    driver.given
      .artifact(anArtifactTableRow({ loadError: faker.lorem.sentence() }))
      .when.rendered();

    expect(await driver.get.version().getSkin()).toBe('error');
  });

  it('should mark version skin standard when override is enabled and artifact has no load error', async () => {
    driver.given
      .artifact(
        anArtifactTableRow({ overrideEnabled: true, loadError: undefined }),
      )
      .when.rendered();

    expect(await driver.get.version().getSkin()).toBe('standard');
  });

  it('should show the load error in tooltip when artifact has a load error and version is hovered', async () => {
    const loadError = faker.lorem.sentence();

    driver.given.artifact(anArtifactTableRow({ loadError })).when.rendered();

    await driver.when.versionHovered();

    expect(await driver.get.tooltip().getTooltipText()).toBe(loadError);
  });

  describe('when override is disabled', () => {
    it('should show the deployed version when deployed build id is canonical', async () => {
      const deployedArtifactVersion = anAppManifest({ buildId: 'canonical' });

      driver.given
        .artifact(
          anArtifactTableRow({
            overrideEnabled: false,
            deployedArtifactVersion,
          }),
        )
        .when.rendered();

      expect(await driver.get.version().getText()).toBe(
        deployedArtifactVersion.version,
      );
    });

    it('should show the deployed version with its build id when deployed build id is not canonical', async () => {
      const deployedArtifactVersion = anAppManifest({
        buildId: faker.git.commitSha({ length: 7 }),
      });

      driver.given
        .artifact(
          anArtifactTableRow({
            overrideEnabled: false,
            deployedArtifactVersion,
          }),
        )
        .when.rendered();

      expect(await driver.get.version().getText()).toBe(
        `${deployedArtifactVersion.version}-${deployedArtifactVersion.buildId}`,
      );
    });

    describe('when artifact has no load error', () => {
      beforeEach(() => {
        driver.given.artifact(
          anArtifactTableRow({ overrideEnabled: false, loadError: undefined }),
        );
      });

      it('should mark version skin disabled when rendered', async () => {
        driver.when.rendered();

        expect(await driver.get.version().getSkin()).toBe('disabled');
      });

      it('should not show tooltip when version is hovered', async () => {
        driver.when.rendered();

        await driver.when.versionHovered();

        expect(await driver.get.tooltip().tooltipExists()).toBe(false);
      });
    });
  });

  describe('when override is enabled and artifact has no load error', () => {
    it.each(OVERRIDE_TYPE_LABELS)(
      'should show the %s override label in tooltip when version is hovered',
      async (overrideType, label) => {
        driver.given
          .artifact(
            anArtifactTableRow({
              overrideEnabled: true,
              loadError: undefined,
              overrideType,
            }),
          )
          .when.rendered();

        await driver.when.versionHovered();

        expect(await driver.get.tooltip().getTooltipText()).toBe(label);
      },
    );

    it('should show an empty tooltip when override type is absent and version is hovered', async () => {
      driver.given
        .artifact(
          anArtifactTableRow({
            overrideEnabled: true,
            loadError: undefined,
            overrideType: undefined,
          }),
        )
        .when.rendered();

      await driver.when.versionHovered();

      expect(await driver.get.tooltip().getTooltipText()).toBe('');
    });
  });
});
