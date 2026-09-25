import type { AtlasDevelopmentOfferIds } from '@atlas/schema';
import type { ArtifactVersion } from '../../types/artifact-version';
import type { ColumbusState } from '../../types/columbus-state';
import type { DevelopmentOffers } from '../../types/host-data';
import { reloadHostTab } from '../host-tabs/host-tabs';
import { validateLocalOverride } from '../local-override/local-override';
import { createOverrideDocument } from '../override-document/override-document';
import {
  writeDisabledArtifactVersionOverrides,
  writeOverrideDocument,
} from '../override-storage/override-storage';

export async function persistColumbusState(
  columbusState: ColumbusState,
): Promise<void> {
  await Promise.all(
    [...columbusState.enabledArtifactVersionOverrides.values()].map(
      validateLocalOverride,
    ),
  );
  const offers = columbusState.hostData.developmentOffers;
  const offeredArtifactVersions = offers
    ? offeredArtifactVersionsOf(offers)
    : new Map<string, ArtifactVersion>();
  const selectedOverrides = new Map(
    [...columbusState.enabledArtifactVersionOverrides].filter(
      ([artifactKey, artifactVersion]) =>
        !isSameBuild({
          offered: offeredArtifactVersions.get(artifactKey),
          enabled: artifactVersion,
        }),
    ),
  );

  await writeOverrideDocument({
    tabId: columbusState.tabId,
    hostData: columbusState.hostData,
    documentValue: createOverrideDocument({
      hostData: columbusState.hostData,
      overrides: selectedOverrides,
    }),
    scope: columbusState.scope,
    dismissedOfferIds: offers
      ? dismissedOfferIdsOf({
          offers,
          offeredArtifactVersions,
          storedDismissedOfferIds: columbusState.hostData.dismissedOfferIds,
          enabledArtifactVersionOverrides:
            columbusState.enabledArtifactVersionOverrides,
        })
      : columbusState.hostData.dismissedOfferIds,
  });
  await writeDisabledArtifactVersionOverrides(
    {
      hostId: columbusState.hostData.config.hostId,
      tabId: columbusState.tabId,
      scope: columbusState.scope,
    },
    columbusState.disabledArtifactVersionOverrides,
  );
  await reloadHostTab(columbusState.tabId);
}

function offeredArtifactVersionsOf(
  offers: DevelopmentOffers,
): Map<string, ArtifactVersion> {
  const offeredArtifactVersions = new Map(
    offers.overrides.map((override) => [override.appId, override.manifest]),
  );

  if (offers.hostOverride)
    offeredArtifactVersions.set(offers.hostOverride.id, offers.hostOverride);

  return offeredArtifactVersions;
}

function dismissedOfferIdsOf({
  offers,
  offeredArtifactVersions,
  storedDismissedOfferIds,
  enabledArtifactVersionOverrides,
}: {
  offers: DevelopmentOffers;
  offeredArtifactVersions: Map<string, ArtifactVersion>;
  storedDismissedOfferIds: AtlasDevelopmentOfferIds;
  enabledArtifactVersionOverrides: Map<string, ArtifactVersion>;
}): AtlasDevelopmentOfferIds {
  const unofferedDismissals = Object.entries(storedDismissedOfferIds).filter(
    ([artifactKey]) => !(artifactKey in offers.offerIds),
  );
  const offerDismissals = Object.entries(offers.offerIds).filter(
    ([artifactKey]) =>
      !isSameBuild({
        offered: offeredArtifactVersions.get(artifactKey),
        enabled: enabledArtifactVersionOverrides.get(artifactKey),
      }),
  );

  return Object.fromEntries([...unofferedDismissals, ...offerDismissals]);
}

function isSameBuild({
  offered,
  enabled,
}: {
  offered: ArtifactVersion | undefined;
  enabled: ArtifactVersion | undefined;
}): boolean {
  return (
    offered !== undefined &&
    enabled !== undefined &&
    offered.channel === enabled.channel &&
    offered.remoteEntryUrl === enabled.remoteEntryUrl
  );
}
