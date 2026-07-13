import "zone.js";
import type { AtlasHostClientEntry } from "@atlas/sdk/lifecycle";
import { bootstrap } from "./bootstrap";

export const mount: AtlasHostClientEntry["mount"] = (request) => bootstrap(request);
