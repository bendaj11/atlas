export const ATLAS_VERSION_CHANNELS = ['production', 'pr', 'local'] as const;

/** Runtime channel. Retained releases remain production artifacts without deployment history. */
export type AtlasVersionChannel = (typeof ATLAS_VERSION_CHANNELS)[number];
