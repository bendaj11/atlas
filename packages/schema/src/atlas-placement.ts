import type { AtlasPlacementKind } from './atlas-placement-kind.js';
import type { AtlasRouteContribution } from './atlas-route-contribution.js';

/** Route or host slot where an app can be mounted. */
export interface AtlasPlacement {
  /** Short stable name for this mount, unique for this host inside the app. */
  id: string;
  /** Use "route" for a full page, or "slot" for a named area inside an existing page. */
  kind: AtlasPlacementKind;
  /** Host app that may use this placement. */
  hostId: string;
  /** Name of the host area to render into when kind is "slot". */
  slot?: string;
  /** Host paths where a slot placement is shown. Matches each path and descendants. */
  showOnPaths?: string[];
  /** Host paths where a slot placement is hidden. Matches each path and descendants. */
  hideOnPaths?: string[];
  /** URL and menu details when kind is "route". */
  route?: AtlasRouteContribution;
}
