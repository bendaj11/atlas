import { createContext, createElement as createReactElement, useContext, type ReactElement, type ReactNode } from "react";
import type { AtlasExportedComponentEntry, AtlasExportedComponentMountRequest, AtlasMfContext, AtlasMfEntry, AtlasMfMountRequest, AtlasMfMountResult } from "./lifecycle.js";
import type { AtlasEventMap, AtlasSdk } from "./host.js";
import type { AtlasLocation, AtlasNavigation } from "./navigation.js";

export interface RootAdapter {
  render(element: unknown): void;
  unmount(): void;
}

const AtlasSdkContext = createContext<AtlasSdk | undefined>(undefined);

export function AtlasSdkProvider({ sdk, children }: { sdk: AtlasSdk; children: ReactNode }): ReactElement {
  return createReactElement(AtlasSdkContext.Provider, { value: sdk }, children);
}

export function useAtlasSdk<
  TExtensions extends object = {},
  TEvents extends object = AtlasEventMap,
  THostData extends object = {}
>(): AtlasSdk<TExtensions, TEvents, THostData> {
  const sdk = useContext(AtlasSdkContext);
  if (!sdk) throw new Error("useAtlasSdk must be used inside an Atlas microfrontend.");
  return sdk as AtlasSdk<TExtensions, TEvents, THostData>;
}

export interface MicrofrontendOptions {
  createRoot(container: HTMLElement): RootAdapter;
  createElement(request: AtlasMfMountRequest): unknown;
}

export function defineMicrofrontend(options: MicrofrontendOptions): AtlasMfEntry {
  return {
    mount(request): AtlasMfMountResult {
      const root = options.createRoot(request.container);
      root.render(createReactElement(AtlasSdkContext.Provider, { value: request.hostSdk }, options.createElement(request) as ReactNode));
      return {
        unmount() {
          root.unmount();
        }
      };
    }
  };
}

export function createRoutedMicrofrontend<TRouter extends MfRouterLike>(options: {
  createRoot(container: HTMLElement): RootAdapter;
  createRouter(request: AtlasMfMountRequest): TRouter;
  createElement(router: TRouter, request: AtlasMfMountRequest): unknown;
}): AtlasMfEntry {
  return {
    mount(request): AtlasMfMountResult {
      const root = options.createRoot(request.container);
      const router = options.createRouter(request);
      const disconnect = connectRouter(router, request.context);
      root.render(createReactElement(AtlasSdkContext.Provider, { value: request.hostSdk }, options.createElement(router, request) as ReactNode));
      request.context.ready();
      return {
        unmount() {
          disconnect();
          router.dispose?.();
          root.unmount();
        }
      };
    }
  };
}

export function defineExportedComponent<TProps extends object>(options: {
  createRoot(container: HTMLElement): RootAdapter;
  createElement(request: AtlasExportedComponentMountRequest<TProps>): unknown;
}): AtlasExportedComponentEntry<TProps> {
  return {
    mount(request): AtlasMfMountResult {
      const root = options.createRoot(request.container);
      root.render(options.createElement(request));
      return { unmount: () => root.unmount() };
    }
  };
}

export interface RouterLike {
  readonly state: { location: { pathname: string; search?: string; hash?: string }; historyAction?: string };
  navigate(to: string | number, options?: { replace?: boolean; state?: unknown }): Promise<void> | void;
  subscribe(listener: () => void): () => void;
}

export interface MfRouterLike extends RouterLike {
  dispose?(): void;
}

/** Options passed to React Router's createMemoryRouter for an Atlas MF. */
export function createRouterOptions(context: AtlasMfContext): { initialEntries: string[] } {
  return { initialEntries: [readAtlasInnerUrl(context)] };
}

/**
 * Keeps a React Router memory router synchronized with the host-owned URL.
 * MF code continues to use Link, useNavigate, loaders, and RouterProvider normally.
 */
export function connectRouter(router: MfRouterLike, context: AtlasMfContext): () => void {
  let synchronizing = false;
  const routerUrl = () => `${router.state.location.pathname}${router.state.location.search ?? ""}${router.state.location.hash ?? ""}`;

  const stopRouter = router.subscribe(() => {
    if (synchronizing) return;
    const next = routerUrl();
    if (next === readAtlasInnerUrl(context)) return;
    if (router.state.historyAction === "REPLACE") context.navigation.replace(next);
    else context.navigation.navigate(next);
  });

  const stopAtlas = context.route.subscribe(() => {
    const next = readAtlasInnerUrl(context);
    if (next === routerUrl()) return;
    synchronizing = true;
    Promise.resolve(router.navigate(next, { replace: true })).finally(() => { synchronizing = false; });
  });

  return () => {
    stopAtlas();
    stopRouter();
  };
}

function readAtlasInnerUrl(context: AtlasMfContext): string {
  const inner = context.route.getCurrent();
  const host = context.navigation.getCurrentLocation();
  return `${inner.pathname}${host.search}${host.hash}`;
}

export function createHostNavigation(router: RouterLike, origin = typeof window === "undefined" ? "http://localhost" : window.location.origin): AtlasNavigation {
  const read = (): AtlasLocation => ({
    pathname: router.state.location.pathname,
    search: router.state.location.search ?? "",
    hash: router.state.location.hash ?? ""
  });
  return {
    navigate(to, options) { void router.navigate(to, { ...(options?.replace !== undefined ? { replace: options.replace } : {}), ...(options?.state !== undefined ? { state: options.state } : {}) }); },
    replace(to, options) { void router.navigate(to, { replace: true, ...(options?.state !== undefined ? { state: options.state } : {}) }); },
    back() { void router.navigate(-1); },
    go(delta) { void router.navigate(delta); },
    createHref(to) { return new URL(to, origin).toString(); },
    subscribe(listener) { listener(read()); return router.subscribe(() => listener(read())); },
    getCurrentLocation: read
  };
}
