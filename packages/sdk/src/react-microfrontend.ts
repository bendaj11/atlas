import { createElement as createReactElement, type ReactNode } from "react";
import type { AtlasExportedComponentEntry, AtlasExportedComponentMountRequest, AtlasMfEntry, AtlasMfMountRequest, AtlasMfMountResult } from "./lifecycle.js";
import { AtlasRuntimeContext, AtlasSdkContext } from "./react-context.js";
import { connectRouter, type MfRouterLike } from "./react-router.js";

export interface RootAdapter {
  render(element: unknown): void;
  unmount(): void;
}

export interface MicrofrontendOptions {
  createRoot(container: HTMLElement): RootAdapter;
  createElement(request: AtlasMfMountRequest): unknown;
}

export function defineMicrofrontend(options: MicrofrontendOptions): AtlasMfEntry {
  return {
    mount(request): AtlasMfMountResult {
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

function renderWithAtlasProviders(request: AtlasMfMountRequest, element: unknown): ReactNode {
  return createReactElement(
    AtlasSdkContext.Provider,
    { value: request.sdk },
    createReactElement(AtlasRuntimeContext.Provider, { value: request.context }, element as ReactNode)
  );
}
