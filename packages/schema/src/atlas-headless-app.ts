/** Host-owned navigation target that changes the URL without mounting an app. */
export interface AtlasHeadlessApp {
  /** Stable target identity used with `atlas.navigateTo()`. */
  id: string;
  /** URL path for this host-owned page. */
  path: string;
}
