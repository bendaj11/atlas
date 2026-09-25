import { faker } from '@faker-js/faker';
import { aHostManifest, anAppManifest } from '@atlas/testkit';
import type { AtlasRuntimeOverrideReason } from '../atlas-runtime-override.js';
import {
  dismissedDevelopmentOffersKey,
  isDevelopmentOfferDismissed,
  isDevelopmentOfferIds,
  mergeDevelopmentOffers,
  parseDismissedDevelopmentOffers,
} from './development-offers.js';

const REASONS: AtlasRuntimeOverrideReason[] = ['local', 'pr', 'historical'];

describe('dismissedDevelopmentOffersKey', () => {
  it('should scope the key to the host when built', () => {
    const hostId = faker.string.uuid();

    expect(dismissedDevelopmentOffersKey(hostId)).toBe(
      `atlas.dismissed-development-offers.${hostId}`,
    );
  });
});

describe('parseDismissedDevelopmentOffers', () => {
  it('should return no dismissed offers when nothing is stored', () => {
    expect(parseDismissedDevelopmentOffers(null)).toStrictEqual({});
  });

  it('should return the stored offer ids when they map artifact ids to offer ids', () => {
    const offerIds = { [faker.string.uuid()]: faker.date.past().toISOString() };

    expect(
      parseDismissedDevelopmentOffers(JSON.stringify(offerIds)),
    ).toStrictEqual(offerIds);
  });

  it.each([
    faker.lorem.word(),
    JSON.stringify([faker.string.uuid()]),
    JSON.stringify({ [faker.string.uuid()]: faker.number.int() }),
  ])(
    'should return no dismissed offers when the stored value is %s',
    (stored) => {
      expect(parseDismissedDevelopmentOffers(stored)).toStrictEqual({});
    },
  );
});

describe('isDevelopmentOfferDismissed', () => {
  it('should return true when the dismissed offer id matches the live offer id', () => {
    const artifactId = faker.string.uuid();
    const offerId = faker.date.past().toISOString();

    expect(
      isDevelopmentOfferDismissed({
        artifactId,
        offerIds: { [artifactId]: offerId },
        dismissedOfferIds: { [artifactId]: offerId },
      }),
    ).toBe(true);
  });

  it('should return false when the dismissed offer id belongs to an earlier offer', () => {
    const artifactId = faker.string.uuid();

    expect(
      isDevelopmentOfferDismissed({
        artifactId,
        offerIds: { [artifactId]: faker.date.recent().toISOString() },
        dismissedOfferIds: { [artifactId]: faker.date.past().toISOString() },
      }),
    ).toBe(false);
  });

  it('should return false when the artifact has no live offer', () => {
    const artifactId = faker.string.uuid();

    expect(
      isDevelopmentOfferDismissed({
        artifactId,
        offerIds: {},
        dismissedOfferIds: { [artifactId]: faker.date.past().toISOString() },
      }),
    ).toBe(false);
  });
});

describe('mergeDevelopmentOffers', () => {
  it('should add offered app overrides when they are not dismissed', () => {
    const manifest = anAppManifest();
    const offered = {
      appId: manifest.id,
      manifest,
      reason: faker.helpers.arrayElement(REASONS),
    };

    expect(
      mergeDevelopmentOffers({
        selection: { overrides: [] },
        offers: {
          overrides: [offered],
          offerIds: { [manifest.id]: faker.date.past().toISOString() },
        },
        dismissedOfferIds: {},
      }),
    ).toStrictEqual({ overrides: [offered] });
  });

  it('should skip offered app overrides when their offer is dismissed', () => {
    const manifest = anAppManifest();
    const offerId = faker.date.past().toISOString();

    expect(
      mergeDevelopmentOffers({
        selection: { overrides: [] },
        offers: {
          overrides: [
            {
              appId: manifest.id,
              manifest,
              reason: faker.helpers.arrayElement(REASONS),
            },
          ],
          offerIds: { [manifest.id]: offerId },
        },
        dismissedOfferIds: { [manifest.id]: offerId },
      }),
    ).toStrictEqual({ overrides: [] });
  });

  it('should keep the selected app override when the same app is offered', () => {
    const selectedManifest = anAppManifest();
    const selected = {
      appId: selectedManifest.id,
      manifest: selectedManifest,
      reason: faker.helpers.arrayElement(REASONS),
    };

    expect(
      mergeDevelopmentOffers({
        selection: { overrides: [selected] },
        offers: {
          overrides: [
            {
              appId: selectedManifest.id,
              manifest: anAppManifest({ id: selectedManifest.id }),
              reason: faker.helpers.arrayElement(REASONS),
            },
          ],
          offerIds: {
            [selectedManifest.id]: faker.date.past().toISOString(),
          },
        },
        dismissedOfferIds: {},
      }),
    ).toStrictEqual({ overrides: [selected] });
  });

  it('should use the offered host override when no host override is selected', () => {
    const hostOverride = aHostManifest();

    expect(
      mergeDevelopmentOffers({
        selection: { overrides: [] },
        offers: {
          overrides: [],
          hostOverride,
          offerIds: { [hostOverride.id]: faker.date.past().toISOString() },
        },
        dismissedOfferIds: {},
      }),
    ).toStrictEqual({ overrides: [], hostOverride });
  });

  it('should skip the offered host override when its offer is dismissed', () => {
    const hostOverride = aHostManifest();
    const offerId = faker.date.past().toISOString();

    expect(
      mergeDevelopmentOffers({
        selection: { overrides: [] },
        offers: {
          overrides: [],
          hostOverride,
          offerIds: { [hostOverride.id]: offerId },
        },
        dismissedOfferIds: { [hostOverride.id]: offerId },
      }),
    ).toStrictEqual({ overrides: [] });
  });

  it('should keep the selected host override when a host override is offered', () => {
    const selectedHost = aHostManifest();
    const offeredHost = aHostManifest({ id: selectedHost.id });

    expect(
      mergeDevelopmentOffers({
        selection: { overrides: [], hostOverride: selectedHost },
        offers: {
          overrides: [],
          hostOverride: offeredHost,
          offerIds: { [offeredHost.id]: faker.date.past().toISOString() },
        },
        dismissedOfferIds: {},
      }),
    ).toStrictEqual({ overrides: [], hostOverride: selectedHost });
  });
});

describe('isDevelopmentOfferIds', () => {
  it('should return true when every artifact id maps to an offer id', () => {
    expect(
      isDevelopmentOfferIds({
        [faker.string.uuid()]: faker.date.past().toISOString(),
      }),
    ).toBe(true);
  });

  it.each([null, [faker.string.uuid()], { [faker.string.uuid()]: 1 }])(
    'should return false when the value is %p',
    (value) => {
      expect(isDevelopmentOfferIds(value)).toBe(false);
    },
  );
});
