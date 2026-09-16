export const ATLAS_DOM_ISOLATIONS = [
  'shared-dom',
  'shadow-dom',
  'scoped',
] as const;

/** How Atlas separates an app's DOM and styles from the host page. */
export type AtlasDomIsolation = (typeof ATLAS_DOM_ISOLATIONS)[number];

/** DOM isolation choices supported in app source configuration. */
export type AtlasAppDomIsolation = Exclude<AtlasDomIsolation, 'scoped'>;
