import type { AtlasRouteNavigation } from './atlas-route-navigation.js';

/** Page this app adds to a host, including URL path and optional menu information. */
export interface AtlasRouteContribution {
  /** URL path users visit to see this app, such as "/checkout". No query string or hash. */
  path: string;
  /** Require the whole URL to match. Prefix matching is the default. */
  match?: 'prefix' | 'full';
  /** Replaces the current URL without mounting this route's app. */
  redirectTo?: string;
  /** Host layout to activate while this route is active. Defaults to "default". */
  layoutId?: string;
  /** Static page title hosts can show before the app sets a dynamic title. */
  title?: string;
  /** Optional menu settings if the host shows this route in navigation. */
  nav?: AtlasRouteNavigation;
}
