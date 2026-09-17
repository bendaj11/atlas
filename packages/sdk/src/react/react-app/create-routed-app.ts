import type { AtlasAppEntry, AtlasAppMountResult } from '../../lifecycle.js';
import { connectRouter, type AppRouterLike } from '../react-router/index.js';
import { withAtlasProviders } from './atlas-providers.js';
import type { RoutedAppOptions } from './react-app.types.js';

/** Defines a React app entry whose memory router stays synchronized with the host URL. */
export function createRoutedApp<TRouter extends AppRouterLike>(
  options: RoutedAppOptions<TRouter>,
): AtlasAppEntry {
  return {
    mount(request): AtlasAppMountResult {
      const root = options.createRoot(request.container);
      const router = options.createRouter(request);
      const disconnect = connectRouter(router, request.context);

      root.render(
        withAtlasProviders(request, options.createElement(router, request)),
      );

      return {
        unmount() {
          disconnect();
          router.dispose?.();
          root.unmount();
        },
      };
    },
  };
}
