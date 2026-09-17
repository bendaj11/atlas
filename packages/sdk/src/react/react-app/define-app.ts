import type { AtlasAppEntry, AtlasAppMountResult } from '../../lifecycle.js';
import { withAtlasProviders } from './atlas-providers.js';
import type { AppOptions } from './react-app.types.js';

/** Defines a React app entry that renders one root per mount and unmounts it on request. */
export function defineApp(options: AppOptions): AtlasAppEntry {
  return {
    mount(request): AtlasAppMountResult {
      const root = options.createRoot(request.container);
      root.render(withAtlasProviders(request, options.createElement(request)));

      return {
        unmount() {
          root.unmount();
        },
      };
    },
  };
}
