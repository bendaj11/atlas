export const ATLAS_PLACEMENT_KINDS = ['route', 'slot'] as const;

/** How the app appears in a host: as its own page route or inside a named area on a page. */
export type AtlasPlacementKind = (typeof ATLAS_PLACEMENT_KINDS)[number];
