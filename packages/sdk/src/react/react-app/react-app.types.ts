import type { ReactNode } from 'react';
import type {
  AtlasAppMountRequest,
  AtlasExportedWidgetMountRequest,
} from '../../lifecycle.js';
import type { AppRouterLike } from '../react-router/index.js';

export type RenderRoot = (element: unknown) => void;

export type UnmountRoot = () => void;

/**
 * Minimal React root surface; `react-dom/client` roots and legacy `render` adapters both satisfy it.
 * Members stay method-style so a root created by any React version is assignable.
 */
export interface RootAdapter {
  render(element: unknown): void;
  unmount(): void;
}

export type CreateRoot = (container: HTMLElement) => RootAdapter;

export interface AppOptions {
  createRoot(container: HTMLElement): RootAdapter;
  createElement(request: AtlasAppMountRequest): ReactNode;
}

export interface RoutedAppOptions<TRouter extends AppRouterLike> {
  createRoot(container: HTMLElement): RootAdapter;
  createRouter(request: AtlasAppMountRequest): TRouter;
  createElement(router: TRouter, request: AtlasAppMountRequest): ReactNode;
}

export interface ExportedWidgetOptions<TProps extends object> {
  createRoot(container: HTMLElement): RootAdapter;
  createElement(request: AtlasExportedWidgetMountRequest<TProps>): ReactNode;
}
