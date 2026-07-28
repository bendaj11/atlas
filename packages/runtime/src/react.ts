import { createContext, createElement, Fragment, useContext, useEffect, useState, type ReactElement, type ReactNode } from "react";
import { AtlasSdkProvider, createHostNavigation, type RouterLike } from "@atlas/sdk/react";
import { startDomHost, type DomHostOptions } from "./dom-host.js";
import { createDomHostSdk } from "./dom-host-sdk.js";
import { readAtlasNavigationItems, subscribeAtlasNavigationItems, type AtlasHostNavigationItem, type AtlasHostRuntime } from "./index.js";
import { AtlasHostAnchorRegistry, type AtlasHostAnchorKind } from "./host-anchors.js";

const AtlasHostAnchorsContext = createContext<AtlasHostAnchorRegistry | undefined>(undefined);

export function AtlasDefaultHostLayout(): ReactElement {
  return createElement(
    Fragment,
    null,
    createElement(AtlasHostStatus),
    createElement(
      "header",
      null,
      createElement("strong", null, "Atlas"),
      createElement(AtlasSlot, { name: "header" })
    ),
    createElement(AtlasNavigation, { "aria-label": "Application" }),
    createElement(AtlasRouteOutlet)
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
  const [{ options, sdk, anchors }] = useState(() => createProviderState(props));

  useEffect(() => {
    let active = true;
    let runtime: AtlasHostRuntime | undefined;

    void Promise.resolve().then(async () => {
      if (!active) return;
      try {
        runtime = await startHost(options);
        if (!active) await runtime.stop();
      } catch {
        // startDomHost already renders and reports one structured browser error.
      }
    });

    return () => {
      active = false;
      if (runtime) void runtime.stop();
    };
  }, [options]);

  return createElement(AtlasHostAnchorsContext.Provider, {
    value: anchors,
    children: createElement(AtlasSdkProvider, { sdk, children: props.children })
  });
}

function createProviderState<THostSdk extends object>(
  props: AtlasHostProviderProps<THostSdk>
): { options: HostOptions<THostSdk>; sdk: ReturnType<typeof createDomHostSdk<THostSdk>>; anchors: AtlasHostAnchorRegistry } {
  const { hostId, options: hostOptions } = props;
  const navigation = hostOptions.navigation ?? createHostNavigation(hostOptions.router);
  const sdk = createDomHostSdk(hostOptions, hostId, navigation);
  const anchors = new AtlasHostAnchorRegistry();
  return { options: { ...hostOptions, navigation, sdk, anchors }, sdk, anchors };
}

export function AtlasHostStatus(): ReactElement { return useHostAnchor("status"); }
export function AtlasNavigation(props: { "aria-label"?: string }): ReactElement { return useHostAnchor("navigation", undefined, props); }
export function AtlasRouteOutlet(): ReactElement { return useHostAnchor("route-outlet"); }
export function AtlasSlot(props: { name: string }): ReactElement { return useHostAnchor("slot", props.name); }

function useHostAnchor(kind: AtlasHostAnchorKind, name?: string, props?: Record<string, string | undefined>): ReactElement {
  const anchors = useContext(AtlasHostAnchorsContext);
  if (!anchors) throw new Error("Atlas host anchors must be rendered inside AtlasHostProvider.");
  const [element, setElement] = useState<HTMLElement | null>(null);
  useEffect(() => element ? anchors.register(kind, element, name) : undefined, [anchors, element, kind, name]);
  return createElement(anchorTag(kind), { ...props, ref: setElement });
}

function anchorTag(kind: AtlasHostAnchorKind): string {
  return `atlas-${kind}`;
}

export function useAtlasNavigationItems(document: Document = globalThis.document): readonly AtlasHostNavigationItem[] {
  const [items, setItems] = useState(() => readAtlasNavigationItems(document));
  useEffect(() => {
    setItems(readAtlasNavigationItems(document));
    return subscribeAtlasNavigationItems(setItems, document);
  }, [document]);
  return items;
}
