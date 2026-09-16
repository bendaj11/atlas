export const ATLAS_FRAMEWORKS = ['angular', 'react', 'vue'] as const;

/** Framework your app was built with. Atlas uses this to choose the right mounting behavior. */
export type AtlasFramework = (typeof ATLAS_FRAMEWORKS)[number];
