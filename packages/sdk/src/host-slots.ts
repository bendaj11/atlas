import { placementTargetsHost, type AtlasManifest } from '@atlas/schema';

export interface AtlasSlotRenderRequest {
  manifest: AtlasManifest;
  slot: string;
  container: HTMLElement;
}

export function findManifestsForSlot(
  manifests: AtlasManifest[],
  hostId: string,
  slot: string,
): AtlasManifest[] {
  return manifests.filter((manifest) =>
    manifest.placements.some(
      (placement) =>
        placementTargetsHost(placement, hostId) &&
        placement.kind === 'slot' &&
        placement.slot === slot,
    ),
  );
}
