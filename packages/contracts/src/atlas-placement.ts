import type { AtlasPlacementKind } from "./atlas-placement-kind.js";
import type { AtlasRouteContribution } from "./atlas-route-contribution.js";

/** Place where a host is allowed to show this app. */
export interface AtlasPlacement {
  /** Short stable name for this placement, unique inside this app. */
  id: string;
  /** Use "route" for a full page, or "slot" for a named area inside an existing page. */
  kind: AtlasPlacementKind;
  /** Host app that may use this placement. */
  hostId: string;
  /** Name of the host area to render into when kind is "slot". */
  slot?: string;
  /** URL and menu details when kind is "route". */
  route?: AtlasRouteContribution;
}
