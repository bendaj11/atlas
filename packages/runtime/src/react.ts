import { createElement, Fragment, useEffect, useState, type ReactElement, type ReactNode } from "react";
import { AtlasSdkProvider, createHostNavigation, type RouterLike } from "@atlas/sdk/react";
import { startDomHost, type DomHostOptions } from "./dom-host.js";
import { createDomHostSdk } from "./dom-host-sdk.js";
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

export type HostOptions<THostSdk extends object = {}> = DomHostOptions<THostSdk> & {
  router: RouterLike;
};

export interface AtlasHostProviderProps<THostSdk extends object = {}> {
  children: ReactNode;
  hostId: string;
  options: HostOptions<THostSdk>;
}

/** Boots Atlas discovery, Native Federation, routing, slots, and lifecycle for a React host. */
export async function startHost<THostSdk extends object = {}>(
  options: HostOptions<THostSdk>
): Promise<AtlasHostRuntime> {
  return startDomHost(options, {
    createNavigation: () => options.navigation ?? createHostNavigation(options.router)
  });
}

/** Provides one host-owned SDK and starts Atlas after the host tree commits. */
export function AtlasHostProvider<THostSdk extends object = {}>(
  props: AtlasHostProviderProps<THostSdk>
): ReactElement {
  const [{ options, sdk }] = useState(() => createProviderState(props));

  useEffect(() => {
    let active = true;
    let runtime: AtlasHostRuntime | undefined;

    void Promise.resolve().then(async () => {
      if (!active) return;
      try {
        runtime = await startHost(options);
        if (!active) await runtime.stop();
      } catch (error) {
        if (active) console.error("Atlas host failed to start:", error);
      }
    });

    return () => {
      active = false;
      if (runtime) void runtime.stop();
    };
  }, [options]);

  return createElement(AtlasSdkProvider, { sdk, children: props.children });
}

function createProviderState<THostSdk extends object>(
  props: AtlasHostProviderProps<THostSdk>
): { options: HostOptions<THostSdk>; sdk: ReturnType<typeof createDomHostSdk<THostSdk>> } {
  const { hostId, options: hostOptions } = props;
  const navigation = hostOptions.navigation ?? createHostNavigation(hostOptions.router);
  const sdk = createDomHostSdk(hostOptions, hostId, navigation);
  return { options: { ...hostOptions, navigation, sdk }, sdk };
}

export function useAtlasNavigationItems(document: Document = globalThis.document): readonly AtlasHostNavigationItem[] {
  const [items, setItems] = useState(() => readAtlasNavigationItems(document));
  useEffect(() => {
    setItems(readAtlasNavigationItems(document));
    return subscribeAtlasNavigationItems(setItems, document);
  }, [document]);
  return items;
}
