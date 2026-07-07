/** Optional menu settings if the host shows a route in navigation. */
export interface AtlasRouteNavigation {
  /** Menu text users see for this route. */
  label: string;
  /** Menu sort number. Lower numbers usually appear first. */
  order?: number;
  /** Set false to keep route working but hide it from menus. */
  visible?: boolean;
}
