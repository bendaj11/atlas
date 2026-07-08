import { createElement, Fragment, type ReactElement } from "react";
import { createHostNavigation, type RouterLike } from "@atlas/sdk/react";
import { startDomHost, type DomHostOptions } from "./dom-host.js";
import type { AtlasHostRuntime } from "./index.js";

export function AtlasDefaultHostLayout(): ReactElement {
  return createElement(
    Fragment,
    null,
    createElement("div", { "data-atlas-host-status": "" }),
    createElement(
      "header",
      null,
      createElement("strong", null, "Atlas"),
      createElement("div", { "data-atlas-slot": "header" })
    ),
    createElement("nav", { "data-atlas-navigation": "", "aria-label": "Application" }),
    createElement("main", { "data-atlas-route-outlet": "" })
  );
}

export interface HostOptions<TExtensions extends object = {}, THostData extends object = {}>
  extends DomHostOptions<TExtensions, THostData> {
  router: RouterLike;
}

/** Boots Atlas discovery, Native Federation, routing, slots, and lifecycle for a React host. */
export async function startHost<TExtensions extends object = {}, THostData extends object = {}>(
  options: HostOptions<TExtensions, THostData>
): Promise<AtlasHostRuntime> {
  return startDomHost(options, {
    createNavigation: () => createHostNavigation(options.router)
  });
}
