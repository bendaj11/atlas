import type {
  AtlasAppMountRequest,
  AtlasExportedWidgetMountRequest,
} from '../../lifecycle.js';
import type { AppRouterLike } from '../react-router/index.js';

export type RenderRoot = (element: unknown) => void;

export type UnmountRoot = () => void;

export type CreateRoot = (container: HTMLElement) => RootAdapter;

/** Minimal React root surface; `react-dom/client` roots and legacy `render` adapters both satisfy it. */
export interface RootAdapter {
  render: RenderRoot;
  unmount: UnmountRoot;
}

export interface AppOptions {
  createRoot: CreateRoot;
  createElement(request: AtlasAppMountRequest): unknown;
}

export interface RoutedAppOptions<TRouter extends AppRouterLike> {
  createRoot: CreateRoot;
  createRouter(request: AtlasAppMountRequest): TRouter;
  createElement(router: TRouter, request: AtlasAppMountRequest): unknown;
}

export interface ExportedWidgetOptions<TProps extends object> {
  createRoot: CreateRoot;
  createElement(request: AtlasExportedWidgetMountRequest<TProps>): unknown;
}
