import { createElement, Fragment, useEffect, useState, type ReactElement } from "react";
import { createHostNavigation, type RouterLike } from "@atlas/sdk/react";
import { startDomHost, type DomHostOptions } from "./dom-host.js";
import { readAtlasNavigationItems, subscribeAtlasNavigationItems, type AtlasHostNavigationItem, type AtlasHostRuntime } from "./index.js";

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

export interface HostOptions<THostSdk extends object = {}>
  extends DomHostOptions<THostSdk> {
  router: RouterLike;
}

/** Boots Atlas discovery, Native Federation, routing, slots, and lifecycle for a React host. */
export async function startHost<THostSdk extends object = {}>(
  options: HostOptions<THostSdk>
): Promise<AtlasHostRuntime> {
  return startDomHost(options, {
    createNavigation: () => createHostNavigation(options.router)
  });
}

export function useAtlasNavigationItems(document: Document = globalThis.document): readonly AtlasHostNavigationItem[] {
  const [items, setItems] = useState(() => readAtlasNavigationItems(document));
  useEffect(() => {
    setItems(readAtlasNavigationItems(document));
    return subscribeAtlasNavigationItems(setItems, document);
  }, [document]);
  return items;
}
