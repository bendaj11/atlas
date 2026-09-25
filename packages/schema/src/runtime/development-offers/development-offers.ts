import type { AtlasHostManifest } from '../../host-manifest/atlas-host-manifest.js';
import type { AtlasRuntimeOverride } from '../atlas-runtime-override.js';

export type AtlasDevelopmentOfferIds = Record<string, string>;

export interface AtlasOverrideSelection<
  TOverride extends { appId?: string } = AtlasRuntimeOverride,
  THost extends { id: string } = AtlasHostManifest,
> {
  overrides: TOverride[];
  hostOverride?: THost;
}

export interface AtlasDevelopmentOffers<
  TOverride extends { appId?: string } = AtlasRuntimeOverride,
  THost extends { id: string } = AtlasHostManifest,
> extends AtlasOverrideSelection<TOverride, THost> {
  offerIds: AtlasDevelopmentOfferIds;
}

interface MergeDevelopmentOffersOptions<
  TOverride extends { appId?: string },
  THost extends { id: string },
> {
  selection: AtlasOverrideSelection<TOverride, THost>;
  offers: AtlasDevelopmentOffers<TOverride, THost>;
  dismissedOfferIds: AtlasDevelopmentOfferIds;
}

interface IsDevelopmentOfferDismissedOptions {
  artifactId: string | undefined;
  offerIds: AtlasDevelopmentOfferIds;
  dismissedOfferIds: AtlasDevelopmentOfferIds;
}

export function dismissedDevelopmentOffersKey(hostId: string): string {
  return `atlas.dismissed-development-offers.${hostId}`;
}

export function parseDismissedDevelopmentOffers(
  stored: string | null,
): AtlasDevelopmentOfferIds {
  if (!stored) return {};

  try {
    const value: unknown = JSON.parse(stored);

    return isDevelopmentOfferIds(value) ? value : {};
  } catch {
    return {};
  }
}

export function isDevelopmentOfferDismissed({
  artifactId,
  offerIds,
  dismissedOfferIds,
}: IsDevelopmentOfferDismissedOptions): boolean {
  if (artifactId === undefined) return false;

  const offerId = offerIds[artifactId];

  return offerId !== undefined && dismissedOfferIds[artifactId] === offerId;
}

export function mergeDevelopmentOffers<
  TOverride extends { appId?: string },
  THost extends { id: string },
>({
  selection,
  offers,
  dismissedOfferIds,
}: MergeDevelopmentOffersOptions<TOverride, THost>): AtlasOverrideSelection<
  TOverride,
  THost
> {
  const selectedAppIds = new Set(
    selection.overrides.map((override) => override.appId),
  );
  const offeredOverrides = offers.overrides.filter(
    (override) =>
      !selectedAppIds.has(override.appId) &&
      !isDevelopmentOfferDismissed({
        artifactId: override.appId,
        offerIds: offers.offerIds,
        dismissedOfferIds,
      }),
  );
  const offeredHost =
    offers.hostOverride &&
    !isDevelopmentOfferDismissed({
      artifactId: offers.hostOverride.id,
      offerIds: offers.offerIds,
      dismissedOfferIds,
    })
      ? offers.hostOverride
      : undefined;
  const hostOverride = selection.hostOverride ?? offeredHost;

  return {
    overrides: [...selection.overrides, ...offeredOverrides],
    ...(hostOverride ? { hostOverride } : {}),
  };
}

export function isDevelopmentOfferIds(
  value: unknown,
): value is AtlasDevelopmentOfferIds {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((offerId) => typeof offerId === 'string')
  );
}
