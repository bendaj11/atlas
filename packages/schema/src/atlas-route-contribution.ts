import type { AtlasRouteNavigation } from "./atlas-route-navigation.js";

/** Page this app adds to a host, including URL path and optional menu information. */
export interface AtlasRouteContribution {
  /** URL path users visit to see this app, such as "/checkout". No query string or hash. */
  basePath: string;
  /** Static page title hosts can show before the app sets a dynamic title. */
  title?: string;
  /** Optional menu settings if the host shows this route in navigation. */
  nav?: AtlasRouteNavigation;
}
