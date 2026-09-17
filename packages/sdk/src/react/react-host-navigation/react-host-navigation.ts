import type {
  AtlasLocation,
  AtlasNavigateOptions,
  AtlasNavigation,
} from '../../navigation.js';
import { resolveDefaultHostOrigin } from '../../navigation/host-origin/host-origin.js';
import type {
  RouterLike,
  RouterNavigateOptions,
} from '../react-router/index.js';

export function createHostNavigation(
  router: RouterLike,
  origin = resolveDefaultHostOrigin(),
): AtlasNavigation {
  const read = (): AtlasLocation => ({
    pathname: router.state.location.pathname,
    search: router.state.location.search ?? '',
    hash: router.state.location.hash ?? '',
  });

  return {
    navigate(to, options) {
      void router.navigate(to, convertToRouterNavigateOptions(options));
    },

    replace(to, options) {
      void router.navigate(
        to,
        convertToRouterNavigateOptions({ ...options, replace: true }),
      );
    },

    back() {
      void router.navigate(-1);
    },

    go(delta) {
      void router.navigate(delta);
    },

    createHref(to) {
      return new URL(to, origin).toString();
    },

    subscribe(listener) {
      listener(read());

      return router.subscribe(() => listener(read()));
    },

    getCurrentLocation: read,
  };
}

function convertToRouterNavigateOptions(
  options: AtlasNavigateOptions | undefined,
): RouterNavigateOptions {
  return {
    ...(options?.replace !== undefined ? { replace: options.replace } : {}),
    ...(options?.state !== undefined ? { state: options.state } : {}),
  };
}
