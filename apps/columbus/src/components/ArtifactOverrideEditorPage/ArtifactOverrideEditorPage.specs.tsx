import { faker } from '@faker-js/faker';
import { anAppManifest } from '@atlas/testkit';
import {
  OVERRIDE_STATUSES,
  type OverrideStatus,
} from '../../types/override-status';
import type { ArtifactVersion } from '../../types/artifact-version';
import { SCOPES } from '../../types/columbus-state';
import { anArtifactOverrideOptions } from '../../testkit/artifact.testkit';
import { aColumbusState } from '../../testkit/columbus-state.testkit';
import { ArtifactOverrideEditorPageDriver } from './ArtifactOverrideEditorPage.driver';

const NOT_ERROR_OVERRIDE_STATUSES: OverrideStatus[] = ['IDLE', 'APPLYING'];
const HOST_CHANNELS: ArtifactVersion['channel'][] = ['production', 'pr'];

describe('ArtifactOverrideEditorPage', () => {
  let driver: ArtifactOverrideEditorPageDriver;

  beforeEach(() => {
    driver = new ArtifactOverrideEditorPageDriver();
  });

  it('should render a replacing Navigate to the artifacts route when there are no override options', async () => {
    await driver.given.overrideOptions(undefined).when.rendered();

    expect(driver.get.navigateMock()).toHaveBeenCalledWith(
      { to: '/', replace: true },
      undefined,
    );
  });

  it('should render a replacing Navigate to the artifacts route when there is no columbus state', async () => {
    await driver.given.columbusState(undefined).when.rendered();

    expect(driver.get.navigateMock()).toHaveBeenCalledWith(
      { to: '/', replace: true },
      undefined,
    );
  });

  it('should not call loadArtifactVersionFromHostTab when no override is selected', async () => {
    const overrideOptions = anArtifactOverrideOptions({
      selectedOverrideArtifactVersion: undefined,
    });

    await driver.given.overrideOptions(overrideOptions).when.rendered();

    expect(driver.get.loadArtifactVersionFromHostTab()).not.toHaveBeenCalled();
  });

  it('should not call loadArtifactVersionFromHostTab when a local override is selected', async () => {
    const overrideOptions = anArtifactOverrideOptions({
      selectedOverrideArtifactVersion: anAppManifest({
        channel: 'local',
        remoteEntryUrl: `http://localhost:${faker.internet.port()}/remoteEntry.json`,
      }),
    });

    await driver.given.overrideOptions(overrideOptions).when.rendered();

    expect(driver.get.loadArtifactVersionFromHostTab()).not.toHaveBeenCalled();
  });

  it.each(HOST_CHANNELS)(
    'should call loadArtifactVersionFromHostTab with the columbus state tab and the selected version when the selected %s version is among its versions',
    async (channel) => {
      const columbusState = aColumbusState();
      const selected = anAppManifest({ channel });
      const overrideOptions = anArtifactOverrideOptions({
        selectedOverrideArtifactVersion: selected,
        productionArtifactVersions: channel === 'production' ? [selected] : [],
        prArtifactVersions: channel === 'pr' ? [selected] : [],
      });

      await driver.given
        .columbusState(columbusState)
        .given.overrideOptions(overrideOptions)
        .when.rendered();

      expect(driver.get.loadArtifactVersionFromHostTab()).toHaveBeenCalledWith({
        tabId: columbusState.tabId,
        manifest: selected,
      });
    },
  );

  it('should show the deployed artifact version name as heading when rendered', async () => {
    const name = faker.commerce.productName();
    const overrideOptions = anArtifactOverrideOptions({
      deployedArtifactVersion: anAppManifest({ name }),
    });

    await driver.given.overrideOptions(overrideOptions).when.rendered();

    expect(await driver.get.heading().getText()).toBe(name);
  });

  it('should check the radio of the overrides scope when rendered', async () => {
    const scope = faker.helpers.arrayElement(SCOPES);

    await driver.given.scope(scope).when.rendered();

    expect(await driver.get.radioGroup().getSelectedValue()).toBe(scope);
  });

  describe('when actions are disabled', () => {
    beforeEach(async () => {
      await driver.given.actionsDisabled(true).when.rendered();
    });

    it('should disable save button when rendered', async () => {
      expect(await driver.get.saveButton().isButtonDisabled()).toBe(true);
    });

    it('should disable cancel button when rendered', async () => {
      expect(await driver.get.cancelButton().isButtonDisabled()).toBe(true);
    });

    it('should disable clear button when rendered', async () => {
      expect(await driver.get.clearButton().isButtonDisabled()).toBe(true);
    });

    it('should disable the scope radios when rendered', async () => {
      expect(await driver.get.radioGroup().isRadioDisabled(0)).toBe(true);
    });
  });

  describe('when actions are enabled', () => {
    beforeEach(() => {
      driver.given.actionsDisabled(false);
    });

    it('should call navigate with the artifacts route when cancel button is clicked', async () => {
      await driver.when.rendered();

      await driver.when.cancelClicked();

      expect(driver.get.navigate()).toHaveBeenCalledWith('/');
    });

    it('should call setScope with the chosen scope when another scope is chosen', async () => {
      const [selected, other] = faker.helpers.shuffle(SCOPES);

      await driver.given.scope(selected).when.rendered();

      await driver.when.scopeChosen(other);

      expect(driver.get.setScope()).toHaveBeenCalledWith(other);
    });

    it('should disable clear button when no artifact version is selected', async () => {
      const overrideOptions = anArtifactOverrideOptions({
        selectedOverrideArtifactVersion: undefined,
      });

      await driver.given.overrideOptions(overrideOptions).when.rendered();

      expect(await driver.get.clearButton().isButtonDisabled()).toBe(true);
    });

    it('should call clearOverride with the deployed artifact version id when clear button is clicked and an artifact version is selected', async () => {
      const overrideOptions = anArtifactOverrideOptions({
        selectedOverrideArtifactVersion: anAppManifest(),
      });

      await driver.given.overrideOptions(overrideOptions).when.rendered();

      await driver.when.clearClicked();

      expect(driver.get.clearOverride()).toHaveBeenCalledWith(
        overrideOptions.deployedArtifactVersion.id,
      );
    });

    describe('when a local override of a deployed version that supports every host is selected', () => {
      const remoteEntryUrl = `http://localhost:${faker.internet.port()}/remoteEntry.json`;
      const overrideOptions = anArtifactOverrideOptions({
        deployedArtifactVersion: anAppManifest({ supportedHosts: ['*'] }),
        selectedOverrideArtifactVersion: anAppManifest({
          channel: 'local',
          remoteEntryUrl,
        }),
      });

      beforeEach(() => {
        driver.given.overrideOptions(overrideOptions);
      });

      it('should call saveOverride with a local manifest of the selected url when save button is clicked', async () => {
        await driver.when.rendered();

        await driver.when.saveClicked();

        expect(driver.get.saveOverride()).toHaveBeenCalledWith({
          deployedArtifactVersion: overrideOptions.deployedArtifactVersion,
          selectedOverrideArtifactVersion: expect.objectContaining({
            channel: 'local',
            remoteEntryUrl,
          }),
        });
      });

      it('should disable save button when save button is clicked and the save is pending', async () => {
        await driver.given.saveOverridePending().when.rendered();

        await driver.when.saveClicked();

        expect(await driver.get.saveButton().isButtonDisabled()).toBe(true);
      });

      describe('when the save fails', () => {
        const reason = faker.lorem.sentence();

        beforeEach(() => {
          driver.given.saveOverrideFailure(reason);
        });

        it.each(OVERRIDE_STATUSES)(
          'should show a failure message of the save error when save button is clicked and override status is %s',
          async (status) => {
            await driver.given.overrideStatus(status).when.rendered();

            await driver.when.saveClicked();

            expect(await driver.get.error().getText()).toContain(reason);
          },
        );
      });
    });

    describe.each(HOST_CHANNELS)(
      'when the selected %s version is among its versions',
      (channel) => {
        const selected = anAppManifest({ channel });
        const overrideOptions = anArtifactOverrideOptions({
          selectedOverrideArtifactVersion: selected,
          productionArtifactVersions:
            channel === 'production' ? [selected] : [],
          prArtifactVersions: channel === 'pr' ? [selected] : [],
        });

        beforeEach(() => {
          driver.given.overrideOptions(overrideOptions);
        });

        it('should disable save button when the host artifact version fails to load', async () => {
          await driver.given
            .hostArtifactVersionLoadFailure(faker.lorem.sentence())
            .when.rendered();

          expect(await driver.get.saveButton().isButtonDisabled()).toBe(true);
        });

        it('should call saveOverride with the host artifact version when save button is clicked and the host artifact version supports every host', async () => {
          const hostArtifactVersion = anAppManifest({ supportedHosts: ['*'] });

          await driver.given
            .hostArtifactVersion(hostArtifactVersion)
            .when.rendered();

          await driver.when.saveClicked();

          expect(driver.get.saveOverride()).toHaveBeenCalledWith({
            deployedArtifactVersion: overrideOptions.deployedArtifactVersion,
            selectedOverrideArtifactVersion: hostArtifactVersion,
          });
        });
      },
    );
  });

  describe('when no override is selected', () => {
    beforeEach(() => {
      driver.given.overrideOptions(
        anArtifactOverrideOptions({
          selectedOverrideArtifactVersion: undefined,
        }),
      );
    });

    it.each(NOT_ERROR_OVERRIDE_STATUSES)(
      'should hide the error when override status is %s',
      async (status) => {
        await driver.given.overrideStatus(status).when.rendered();

        expect(await driver.get.error().exists()).toBe(false);
      },
    );

    it('should show the override message as error when override status is ERROR', async () => {
      const message = faker.lorem.sentence();

      await driver.given
        .overrideStatus('ERROR')
        .given.overrideMessage(message)
        .when.rendered();

      expect(await driver.get.error().getText()).toBe(message);
    });
  });

  describe('when the selected production version is among the production versions and fails to load', () => {
    const reason = faker.lorem.sentence();
    const selected = anAppManifest({ channel: 'production' });

    beforeEach(() => {
      driver.given
        .overrideOptions(
          anArtifactOverrideOptions({
            selectedOverrideArtifactVersion: selected,
            productionArtifactVersions: [selected],
          }),
        )
        .given.hostArtifactVersionLoadFailure(reason);
    });

    it.each(OVERRIDE_STATUSES)(
      'should show a failure message of the load error when override status is %s',
      async (status) => {
        await driver.given.overrideStatus(status).when.rendered();

        expect(await driver.get.error().getText()).toContain(reason);
      },
    );
  });
});
