import type { AtlasRouteNavigation } from "./atlas-route-navigation.js";

/** Page this app adds to a host, including URL path and optional menu information. */
export interface AtlasRouteContribution {
  /** Short stable name for this route, unique inside this app. */
  id: string;
  /** URL path users visit to see this app, such as "/checkout". No query string or hash. */
  basePath: string;
  /** Text hosts can show as the page title, breadcrumb, or menu title. */
  title: string;
  /** Optional menu settings if the host shows this route in navigation. */
  nav?: AtlasRouteNavigation;
}
