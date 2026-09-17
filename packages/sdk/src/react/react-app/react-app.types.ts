import type {
  AtlasAppMountRequest,
  AtlasExportedWidgetMountRequest,
} from '../../lifecycle.js';
import type { AppRouterLike } from '../react-router/react-router.js';

/** Minimal React root surface; `react-dom/client` roots and legacy `render` adapters both satisfy it. */
export interface RootAdapter {
  render(element: unknown): void;
  unmount(): void;
}

export interface AppOptions {
  createRoot(container: HTMLElement): RootAdapter;
  createElement(request: AtlasAppMountRequest): unknown;
}

export interface RoutedAppOptions<TRouter extends AppRouterLike> {
  createRoot(container: HTMLElement): RootAdapter;
  createRouter(request: AtlasAppMountRequest): TRouter;
  createElement(router: TRouter, request: AtlasAppMountRequest): unknown;
}

export interface ExportedWidgetOptions<TProps extends object> {
  createRoot(container: HTMLElement): RootAdapter;
  createElement(request: AtlasExportedWidgetMountRequest<TProps>): unknown;
}
