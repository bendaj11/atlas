import { createElement as createReactElement, type ReactNode } from "react";
import type { AtlasExportedWidgetEntry, AtlasExportedWidgetMountRequest, AtlasAppEntry, AtlasAppMountRequest, AtlasAppMountResult } from "./lifecycle.js";
import { AtlasRuntimeContext, AtlasSdkContext } from "./react-context.js";
import { connectRouter, type AppRouterLike } from "./react-router.js";

export interface RootAdapter {
  render(element: unknown): void;
  unmount(): void;
}

export interface AppOptions {
  createRoot(container: HTMLElement): RootAdapter;
  createElement(request: AtlasAppMountRequest): unknown;
}

export function defineApp(options: AppOptions): AtlasAppEntry {
  return {
    mount(request): AtlasAppMountResult {
      const root = options.createRoot(request.container);
      root.render(renderWithAtlasProviders(request, options.createElement(request)));
      return {
        unmount() {
          root.unmount();
        }
      };
    }
  };
}

export function createRoutedApp<TRouter extends AppRouterLike>(options: {
  createRoot(container: HTMLElement): RootAdapter;
  createRouter(request: AtlasAppMountRequest): TRouter;
  createElement(router: TRouter, request: AtlasAppMountRequest): unknown;
}): AtlasAppEntry {
  return {
    mount(request): AtlasAppMountResult {
      const root = options.createRoot(request.container);
      const router = options.createRouter(request);
      const disconnect = connectRouter(router, request.context);

      root.render(renderWithAtlasProviders(request, options.createElement(router, request)));

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

export function defineExportedWidget<TProps extends object>(options: {
  createRoot(container: HTMLElement): RootAdapter;
  createElement(request: AtlasExportedWidgetMountRequest<TProps>): unknown;
}): AtlasExportedWidgetEntry<TProps> {
  return {
    mount(request): AtlasAppMountResult {
      const root = options.createRoot(request.container);
      root.render(options.createElement(request));
      return { unmount: () => root.unmount() };
    }
  };
}

function renderWithAtlasProviders(request: AtlasAppMountRequest, element: unknown): ReactNode {
  return createReactElement(
    AtlasSdkContext.Provider,
    { value: request.sdk },
    createReactElement(AtlasRuntimeContext.Provider, { value: request.context }, element as ReactNode)
  );
}
