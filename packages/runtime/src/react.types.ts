import type { ComponentType, ReactElement, ReactNode } from 'react';
import type { AtlasHostConfig } from '@atlas/schema';
import type { AtlasHostMountRequest } from '@atlas/sdk/lifecycle';
import type { RouterLike } from '@atlas/sdk/react';
import type { createBrowserRouter } from 'react-router-dom';
import type { AtlasHostUiStore } from './adapters/react-host-ui.types.js';
import type {
  DomHostCustomizationOptions,
  DomHostOptions,
  DomHostUiRenderers,
  DomSdkOptions,
} from './dom-host/dom-host.types.js';
import type { DomHostSdk } from './dom-host/dom-host-sdk.types.js';
import type { AtlasHostAnchorRegistry } from './dom-host/host-anchors.js';

export type HostOptions<THostSdk extends object = {}> =
  DomHostOptions<THostSdk> & {
    router: RouterLike;
  };

/** Product SDK configuration supplied to a React Atlas host. */
export type HostSdkOptions<THostSdk extends object = {}> =
  DomSdkOptions<THostSdk> & DomHostCustomizationOptions;

export interface ReactDomRoot {
  render(children: ReactNode): void;
  unmount(): void;
}

export interface ReactDomRootOptions {
  onUncaughtError?: (error: unknown) => void;
}

export interface ReactDomClient {
  createRoot(container: Element, options?: ReactDomRootOptions): ReactDomRoot;
}

export interface LegacyReactDom {
  render(element: ReactElement, container: Element): void;
  unmountComponentAtNode(container: Element): boolean;
}

export type ReactDomRenderer = ReactDomClient | LegacyReactDom;

export interface AtlasErrorProps {
  error: Error;
  retry: () => void;
}

export interface AtlasHostComponents {
  notFound?: ComponentType;
  loading?: ComponentType;
  error?: ComponentType<AtlasErrorProps>;
  widgetLoading?: ComponentType;
  widgetError?: ComponentType<AtlasErrorProps>;
  hostError?: ComponentType<AtlasErrorProps>;
}

export interface ReactHostDefinition<
  THostSdk extends object = {},
> extends AtlasHostComponents {
  config: Pick<AtlasHostConfig, 'id' | 'name'>;
  layout: ComponentType;
  reactDom: ReactDomRenderer;
  providers?: ComponentType<{ children?: ReactNode }>;
  useSdkOptions: () => HostSdkOptions<THostSdk>;
}

export interface ReactHostApplicationProps<THostSdk extends object> {
  config: Pick<AtlasHostConfig, 'id' | 'name'>;
  layout: ComponentType;
  useSdkOptions: () => HostSdkOptions<THostSdk>;
  components: AtlasHostComponents;
  request: AtlasHostMountRequest;
  router: ReturnType<typeof createBrowserRouter>;
  onReady: () => void;
}

export interface RenderReactHostOptions {
  reactDom: ReactDomRenderer;
  element: ReactElement;
  container: Element;
  onUncaughtError: (error: unknown) => void;
}

export interface ReactHostStartServices {
  onReady?: () => void;
  ui?: DomHostUiRenderers;
}

export interface AtlasHostProviderProps<
  THostSdk extends object = {},
> extends AtlasHostComponents {
  children: ReactNode;
  hostId: string;
  options: HostOptions<THostSdk>;
  onReady?: () => void;
}

export interface HostProviderState<THostSdk extends object> {
  options: HostOptions<THostSdk>;
  sdk: DomHostSdk<THostSdk>;
  anchors: AtlasHostAnchorRegistry;
  store: AtlasHostUiStore;
  services: ReactHostStartServices;
}

export interface AtlasHostLayoutProps {
  layoutId: string;
  children?: ReactNode;
}

export interface AtlasSlotProps {
  slotId: string;
}

export interface AtlasNavigationProps {
  'aria-label'?: string;
}
