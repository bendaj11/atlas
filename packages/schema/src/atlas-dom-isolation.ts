/** How Atlas separates an app's DOM and styles from the host page. */
export type AtlasDomIsolation = 'shared-dom' | 'shadow-dom' | 'scoped';

/** DOM isolation choices supported in app source configuration. */
export type AtlasAppDomIsolation = Exclude<AtlasDomIsolation, 'scoped'>;
