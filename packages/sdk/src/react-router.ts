import type { AtlasMfContext } from "./lifecycle.js";

export interface RouterLike {
  readonly state: { location: { pathname: string; search?: string; hash?: string }; historyAction?: string };
  navigate(to: string | number, options?: { replace?: boolean; state?: unknown }): Promise<void> | void;
  subscribe(listener: () => void): () => void;
}

export interface MfRouterLike extends RouterLike {
  dispose?(): void;
}

/** Options passed to React Router's createMemoryRouter for an Atlas app. */
export function createRouterOptions(context: AtlasMfContext): { initialEntries: string[] } {
  return { initialEntries: [readAtlasInnerUrl(context)] };
}

/**
 * Keeps a React Router memory router synchronized with the host-owned URL.
 * app code continues to use Link, useNavigate, loaders, and RouterProvider normally.
 */
export function connectRouter(router: MfRouterLike, context: AtlasMfContext): () => void {
  let synchronizing = false;

  const stopRouter = router.subscribe(() => {
    if (synchronizing) return;
    syncAtlasFromRouter(router, context);
  });

  const stopAtlas = context.route.subscribe(() => {
    const next = readAtlasInnerUrl(context);
    if (next === readRouterUrl(router)) return;

    synchronizing = true;
    Promise.resolve(router.navigate(next, { replace: true })).finally(() => {
      synchronizing = false;
    });
  });

  return () => {
    stopAtlas();
    stopRouter();
  };
}

export function readAtlasInnerUrl(context: AtlasMfContext): string {
  const inner = context.route.getCurrent();
  const host = context.navigation.getCurrentLocation();
  return `${inner.pathname}${host.search}${host.hash}`;
}

function syncAtlasFromRouter(router: MfRouterLike, context: AtlasMfContext): void {
  const next = readRouterUrl(router);
  if (next === readAtlasInnerUrl(context)) return;

  if (router.state.historyAction === "REPLACE") context.navigation.replace(next);
  else context.navigation.navigate(next);
}

function readRouterUrl(router: RouterLike): string {
  return `${router.state.location.pathname}${router.state.location.search ?? ""}${router.state.location.hash ?? ""}`;
}
