/** Chosen production version for one app. */
export interface AtlasProductionSelection {
  /** App version to use in production, such as "1.2.3". */
  version: string;
  /** Exact build output to use for that version. */
  buildId: string;
}
