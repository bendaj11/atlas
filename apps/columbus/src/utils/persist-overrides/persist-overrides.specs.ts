import { faker } from '@faker-js/faker';
import { aHostManifest, anAppManifest } from '@atlas/testkit';
import { aColumbusState } from '../../testkit/columbus-state.testkit';
import { aHostData } from '../../testkit/host-data.testkit';
import { PersistOverridesDriver } from './persist-overrides.driver';

const { persistColumbusState } = await import('./persist-overrides');

describe('persistColumbusState', () => {
  let driver: PersistOverridesDriver;

  beforeEach(() => {
    driver = new PersistOverridesDriver();
  });

  it('should validate every enabled override when persisting', async () => {
    const first = anAppManifest();
    const second = anAppManifest();

    await persistColumbusState(
      aColumbusState({
        enabledArtifactVersionOverrides: new Map([
          [first.id, first],
          [second.id, second],
        ]),
      }),
    );

    expect(
      driver.get
        .validateLocalOverride()
        .mock.calls.map(([manifest]) => manifest),
    ).toStrictEqual([first, second]);
  });

  describe('when validation fails', () => {
    const reason = faker.lorem.sentence();
    const columbusState = aColumbusState({
      enabledArtifactVersionOverrides: new Map([
        [faker.string.uuid(), anAppManifest()],
      ]),
    });

    beforeEach(() => {
      driver.given.validationFailure(new Error(reason));
    });

    it('should reject with the validation error when persisting', async () => {
      await expect(persistColumbusState(columbusState)).rejects.toThrow(reason);
    });

    it('should not write the override document when persisting', async () => {
      await persistColumbusState(columbusState).catch(() => undefined);

      expect(driver.get.writeOverrideDocument()).not.toHaveBeenCalled();
    });
  });

  it('should write document, disabled overrides, then reload when persisting', async () => {
    await persistColumbusState(aColumbusState());

    const order = [
      driver.get.writeOverrideDocument(),
      driver.get.writeDisabledArtifactVersionOverrides(),
      driver.get.reloadHostTab(),
    ].map((mock) => mock.mock.invocationCallOrder[0]);

    expect(order).toStrictEqual([...order].sort((left, right) => left - right));
  });

  it('should write the override document built from the enabled overrides with no dismissed offers when no development offers exist', async () => {
    const override = anAppManifest({ channel: 'production' });
    const columbusState = aColumbusState({
      hostData: aHostData({ developmentOffers: undefined }),
      enabledArtifactVersionOverrides: new Map([[override.id, override]]),
    });

    await persistColumbusState(columbusState);

    expect(driver.get.writeOverrideDocument()).toHaveBeenCalledWith({
      tabId: columbusState.tabId,
      hostData: columbusState.hostData,
      documentValue: {
        schemaVersion: '1',
        hostId: columbusState.hostData.config.hostId,
        generatedAt: expect.any(String),
        overrides: [
          { appId: override.id, manifest: override, reason: 'historical' },
        ],
      },
      scope: columbusState.scope,
      dismissedOfferIds: {},
    });
  });

  it('should keep the stored dismissed offers when the development offers cannot be read', async () => {
    const dismissedOfferIds = { [faker.string.uuid()]: faker.string.uuid() };

    await persistColumbusState(
      aColumbusState({
        hostData: aHostData({ developmentOffers: undefined, dismissedOfferIds }),
      }),
    );

    expect(driver.get.writeOverrideDocument()).toHaveBeenCalledWith(
      expect.objectContaining({ dismissedOfferIds }),
    );
  });

  describe('when a development offer of an app is live', () => {
    const offered = anAppManifest();
    const offerId = faker.string.uuid();
    const hostData = aHostData({
      developmentOffers: {
        overrides: [{ appId: offered.id, manifest: offered, reason: 'local' }],
        offerIds: { [offered.id]: offerId },
      },
    });

    describe('when the app is enabled with the same channel and remote entry url as the offer', () => {
      const sameBuild = anAppManifest({
        id: offered.id,
        channel: offered.channel,
        remoteEntryUrl: offered.remoteEntryUrl,
      });
      const columbusState = aColumbusState({
        hostData,
        enabledArtifactVersionOverrides: new Map([[offered.id, sameBuild]]),
      });

      it('should write the override document without the offered app when persisting', async () => {
        await persistColumbusState(columbusState);

        expect(driver.get.writeOverrideDocument()).toHaveBeenCalledWith(
          expect.objectContaining({
            documentValue: expect.objectContaining({ overrides: [] }),
          }),
        );
      });

      it('should write no dismissed offers when persisting', async () => {
        await persistColumbusState(columbusState);

        expect(driver.get.writeOverrideDocument()).toHaveBeenCalledWith(
          expect.objectContaining({ dismissedOfferIds: {} }),
        );
      });
    });

    describe('when the app is enabled with the same channel and another remote entry url', () => {
      const replacement = anAppManifest({
        id: offered.id,
        channel: offered.channel,
        remoteEntryUrl: faker.internet.url(),
      });
      const columbusState = aColumbusState({
        hostData,
        enabledArtifactVersionOverrides: new Map([[offered.id, replacement]]),
      });

      it('should write the override document with the replacement when persisting', async () => {
        await persistColumbusState(columbusState);

        expect(driver.get.writeOverrideDocument()).toHaveBeenCalledWith(
          expect.objectContaining({
            documentValue: expect.objectContaining({
              overrides: [expect.objectContaining({ manifest: replacement })],
            }),
          }),
        );
      });

      it('should write the offer id as dismissed when persisting', async () => {
        await persistColumbusState(columbusState);

        expect(driver.get.writeOverrideDocument()).toHaveBeenCalledWith(
          expect.objectContaining({
            dismissedOfferIds: { [offered.id]: offerId },
          }),
        );
      });
    });

    it('should write the offer id as dismissed when the app is enabled with the same remote entry url on another channel', async () => {
      const localOffered = anAppManifest({ channel: 'local' });
      const localOfferId = faker.string.uuid();
      const replacement = anAppManifest({
        id: localOffered.id,
        channel: 'pr',
        remoteEntryUrl: localOffered.remoteEntryUrl,
      });
      const columbusState = aColumbusState({
        hostData: aHostData({
          developmentOffers: {
            overrides: [
              {
                appId: localOffered.id,
                manifest: localOffered,
                reason: 'local',
              },
            ],
            offerIds: { [localOffered.id]: localOfferId },
          },
        }),
        enabledArtifactVersionOverrides: new Map([
          [localOffered.id, replacement],
        ]),
      });

      await persistColumbusState(columbusState);

      expect(driver.get.writeOverrideDocument()).toHaveBeenCalledWith(
        expect.objectContaining({
          dismissedOfferIds: { [localOffered.id]: localOfferId },
        }),
      );
    });

    it('should keep a stored dismissal of an app that is no longer offered when persisting', async () => {
      const unofferedAppId = faker.string.uuid();
      const unofferedOfferId = faker.string.uuid();
      const columbusState = aColumbusState({
        hostData: {
          ...hostData,
          dismissedOfferIds: { [unofferedAppId]: unofferedOfferId },
        },
        enabledArtifactVersionOverrides: new Map([[offered.id, offered]]),
      });

      await persistColumbusState(columbusState);

      expect(driver.get.writeOverrideDocument()).toHaveBeenCalledWith(
        expect.objectContaining({
          dismissedOfferIds: { [unofferedAppId]: unofferedOfferId },
        }),
      );
    });

    it('should drop the stored dismissal of the offered app when it is enabled with the offered build', async () => {
      const columbusState = aColumbusState({
        hostData: { ...hostData, dismissedOfferIds: { [offered.id]: offerId } },
        enabledArtifactVersionOverrides: new Map([[offered.id, offered]]),
      });

      await persistColumbusState(columbusState);

      expect(driver.get.writeOverrideDocument()).toHaveBeenCalledWith(
        expect.objectContaining({ dismissedOfferIds: {} }),
      );
    });

    it('should write the offer id as dismissed when the app is cleared', async () => {
      const columbusState = aColumbusState({
        hostData,
        enabledArtifactVersionOverrides: new Map(),
        disabledArtifactVersionOverrides: new Map(),
      });

      await persistColumbusState(columbusState);

      expect(driver.get.writeOverrideDocument()).toHaveBeenCalledWith(
        expect.objectContaining({
          dismissedOfferIds: { [offered.id]: offerId },
        }),
      );
    });

    it('should write the offer id as dismissed when the app is disabled', async () => {
      const columbusState = aColumbusState({
        hostData,
        enabledArtifactVersionOverrides: new Map(),
        disabledArtifactVersionOverrides: new Map([[offered.id, offered]]),
      });

      await persistColumbusState(columbusState);

      expect(driver.get.writeOverrideDocument()).toHaveBeenCalledWith(
        expect.objectContaining({
          dismissedOfferIds: { [offered.id]: offerId },
        }),
      );
    });
  });

  it('should write no dismissed offers when the host is enabled with the offered host build', async () => {
    const offeredHost = aHostManifest();
    const columbusState = aColumbusState({
      hostData: aHostData({
        developmentOffers: {
          overrides: [],
          hostOverride: offeredHost,
          offerIds: { [offeredHost.id]: faker.string.uuid() },
        },
      }),
      enabledArtifactVersionOverrides: new Map([[offeredHost.id, offeredHost]]),
    });

    await persistColumbusState(columbusState);

    expect(driver.get.writeOverrideDocument()).toHaveBeenCalledWith(
      expect.objectContaining({ dismissedOfferIds: {} }),
    );
  });

  it('should write the disabled overrides under the state location when persisting', async () => {
    const columbusState = aColumbusState({
      disabledArtifactVersionOverrides: new Map([
        [faker.string.uuid(), anAppManifest()],
      ]),
    });

    await persistColumbusState(columbusState);

    expect(
      driver.get.writeDisabledArtifactVersionOverrides(),
    ).toHaveBeenCalledWith(
      {
        hostId: columbusState.hostData.config.hostId,
        tabId: columbusState.tabId,
        scope: columbusState.scope,
      },
      columbusState.disabledArtifactVersionOverrides,
    );
  });

  it('should reload the state tab when everything is written', async () => {
    const columbusState = aColumbusState();

    await persistColumbusState(columbusState);

    expect(driver.get.reloadHostTab()).toHaveBeenCalledWith(
      columbusState.tabId,
    );
  });
});
