import { faker } from '@faker-js/faker';
import { anAppManifest, aVersionOf } from '@atlas/testkit';
import { anArtifactTableRow } from '../../../../testkit/artifact.testkit';
import { aColumbusState } from '../../../../testkit/columbus-state.testkit';
import { aHostData } from '../../../../testkit/host-data.testkit';
import { UseArtifactOverrideOptionsDriver } from './useArtifactOverrideOptions.driver';

describe('useArtifactOverrideOptions', () => {
  let driver: UseArtifactOverrideOptionsDriver;

  beforeEach(() => {
    driver = new UseArtifactOverrideOptionsDriver();
  });

  it('should return undefined when location carries no artifact', () => {
    driver.given.artifact(undefined).when.rendered();

    expect(driver.get.result()).toBeUndefined();
  });

  it('should return undefined when location carries an artifact and there is no columbusState', () => {
    driver.given
      .artifact(anArtifactTableRow())
      .given.columbusState(undefined)
      .when.rendered();

    expect(driver.get.result()).toBeUndefined();
  });

  describe('when location carries an artifact and a columbusState exists', () => {
    it('should return the deployed artifact version when rendered', () => {
      const artifact = anArtifactTableRow();
      driver.given
        .artifact(artifact)
        .given.columbusState(aColumbusState())
        .when.rendered();

      expect(driver.get.result()?.deployedArtifactVersion).toBe(
        artifact.deployedArtifactVersion,
      );
    });

    it('should return the override enabled flag when rendered', () => {
      const artifact = anArtifactTableRow();
      driver.given
        .artifact(artifact)
        .given.columbusState(aColumbusState())
        .when.rendered();

      expect(driver.get.result()?.overrideEnabled).toBe(
        artifact.overrideEnabled,
      );
    });

    it('should return no selected override when no override exists for the artifact', () => {
      const columbusState = aColumbusState({
        enabledArtifactVersionOverrides: new Map(),
        disabledArtifactVersionOverrides: new Map(),
      });
      driver.given
        .artifact(anArtifactTableRow())
        .given.columbusState(columbusState)
        .when.rendered();

      expect(
        driver.get.result()?.selectedOverrideArtifactVersion,
      ).toBeUndefined();
    });

    it('should return the enabled override as selected when only an enabled override exists', () => {
      const artifact = anArtifactTableRow();
      const enabled = anAppManifest();
      const columbusState = aColumbusState({
        enabledArtifactVersionOverrides: new Map([
          [artifact.deployedArtifactVersion.id, enabled],
        ]),
        disabledArtifactVersionOverrides: new Map(),
      });
      driver.given
        .artifact(artifact)
        .given.columbusState(columbusState)
        .when.rendered();

      expect(driver.get.result()?.selectedOverrideArtifactVersion).toBe(
        enabled,
      );
    });

    it('should return the disabled override as selected when only a disabled override exists', () => {
      const artifact = anArtifactTableRow();
      const disabled = anAppManifest();
      const columbusState = aColumbusState({
        enabledArtifactVersionOverrides: new Map(),
        disabledArtifactVersionOverrides: new Map([
          [artifact.deployedArtifactVersion.id, disabled],
        ]),
      });
      driver.given
        .artifact(artifact)
        .given.columbusState(columbusState)
        .when.rendered();

      expect(driver.get.result()?.selectedOverrideArtifactVersion).toBe(
        disabled,
      );
    });

    it('should return the enabled override as selected when both overrides exist', () => {
      const artifact = anArtifactTableRow();
      const enabled = anAppManifest();
      const columbusState = aColumbusState({
        enabledArtifactVersionOverrides: new Map([
          [artifact.deployedArtifactVersion.id, enabled],
        ]),
        disabledArtifactVersionOverrides: new Map([
          [artifact.deployedArtifactVersion.id, anAppManifest()],
        ]),
      });
      driver.given
        .artifact(artifact)
        .given.columbusState(columbusState)
        .when.rendered();

      expect(driver.get.result()?.selectedOverrideArtifactVersion).toBe(
        enabled,
      );
    });

    it('should return host production versions plus the deployed production version as production options when rendered', () => {
      const deployed = anAppManifest({ channel: 'production' });
      const artifact = anArtifactTableRow({
        deployedArtifactVersion: deployed,
      });
      const older = aVersionOf(deployed, { channel: 'production' });
      const columbusState = aColumbusState({
        hostData: aHostData({
          versions: {
            [deployed.id]: [older, aVersionOf(deployed, { channel: 'pr' })],
          },
        }),
      });
      driver.given
        .artifact(artifact)
        .given.columbusState(columbusState)
        .when.rendered();

      expect(driver.get.result()?.productionArtifactVersions).toEqual([
        older,
        deployed,
      ]);
    });

    it('should return the deployed production version once as production option when host versions already include it', () => {
      const deployed = anAppManifest({ channel: 'production' });
      const artifact = anArtifactTableRow({
        deployedArtifactVersion: deployed,
      });
      const columbusState = aColumbusState({
        hostData: aHostData({ versions: { [deployed.id]: [deployed] } }),
      });
      driver.given
        .artifact(artifact)
        .given.columbusState(columbusState)
        .when.rendered();

      expect(driver.get.result()?.productionArtifactVersions).toEqual([
        deployed,
      ]);
    });

    it('should return only host pr versions as pr options when rendered', () => {
      const deployed = anAppManifest({ channel: 'production' });
      const artifact = anArtifactTableRow({
        deployedArtifactVersion: deployed,
      });
      const preview = aVersionOf(deployed, {
        channel: 'pr',
        prNumber: faker.number.int({ min: 1, max: 999 }),
      });
      const columbusState = aColumbusState({
        hostData: aHostData({
          versions: {
            [deployed.id]: [
              aVersionOf(deployed, { channel: 'production' }),
              preview,
            ],
          },
        }),
      });
      driver.given
        .artifact(artifact)
        .given.columbusState(columbusState)
        .when.rendered();

      expect(driver.get.result()?.prArtifactVersions).toEqual([preview]);
    });
  });
});
