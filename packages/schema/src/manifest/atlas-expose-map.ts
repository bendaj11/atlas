/** Public modules this app publishes for the host to load. */
export interface AtlasExposeMap {
  /** Main module the host loads to start this app. Usually "./entry". */
  entry: string;
  /** Extra public modules, keyed by the name consumers import. */
  [name: string]: string;
}
