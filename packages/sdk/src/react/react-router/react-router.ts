import type { AtlasAppContext } from '../../lifecycle.js';
import { readAppInnerUrl } from '../../navigation/app-inner-url/app-inner-url.js';
import type { AppRouterLike, RouterLike } from './react-router.types.js';

export interface MemoryRouterOptions {
  initialEntries: string[];
}

/** Options passed to React Router's createMemoryRouter for an Atlas app. */
export function createRouterOptions(
  context: AtlasAppContext,
): MemoryRouterOptions {
  return { initialEntries: [readAtlasInnerUrl(context)] };
}

/**
 * Keeps a React Router memory router synchronized with the host-owned URL.
 * app code continues to use Link, useNavigate, loaders, and RouterProvider normally.
 */
export function connectRouter(
  router: AppRouterLike,
  context: AtlasAppContext,
): () => void {
  let synchronizing = false;

  const stopRouter = router.subscribe(() => {
    if (synchronizing) return;

    pushRouterUrlToHost(router, context);
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

export function readAtlasInnerUrl(context: AtlasAppContext): string {
  return readAppInnerUrl(context);
}

function pushRouterUrlToHost(
  router: AppRouterLike,
  context: AtlasAppContext,
): void {
  const next = readRouterUrl(router);

  if (next === readAtlasInnerUrl(context)) return;

  if (router.state.historyAction === 'REPLACE') {
    context.navigation.replace(next);

    return;
  }

  context.navigation.navigate(next);
}

function readRouterUrl(router: RouterLike): string {
  const { pathname, search = '', hash = '' } = router.state.location;

  return `${pathname}${search}${hash}`;
}
