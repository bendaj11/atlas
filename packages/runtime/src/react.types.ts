import type { ComponentType, ReactElement, ReactNode } from 'react';
import type { AtlasHostConfig } from '@atlas/schema';
import type { AtlasHostMountRequest } from '@atlas/sdk/lifecycle';
import type { RouterLike } from '@atlas/sdk/react';
import type { createBrowserRouter } from 'react-router-dom';
import type {
  DomHostCustomizationOptions,
  DomHostOptions,
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

export interface ReactDomClient {
  createRoot(container: Element): ReactDomRoot;
}

export interface LegacyReactDom {
  render(element: ReactElement, container: Element): void;
  unmountComponentAtNode(container: Element): boolean;
}

export type ReactDomRenderer = ReactDomClient | LegacyReactDom;

export interface ReactHostDefinition<THostSdk extends object = {}> {
  config: Pick<AtlasHostConfig, 'id' | 'name'>;
  layout: ComponentType;
  reactDom: ReactDomRenderer;
  providers?: ComponentType<{ children?: ReactNode }>;
  useSdkOptions: () => HostSdkOptions<THostSdk>;
}

export interface ReactHostApplicationProps<THostSdk extends object> {
  definition: ReactHostDefinition<THostSdk>;
  request: AtlasHostMountRequest;
  router: ReturnType<typeof createBrowserRouter>;
}

export interface RenderReactHostOptions {
  reactDom: ReactDomRenderer;
  element: ReactElement;
  container: Element;
}

export interface AtlasHostProviderProps<THostSdk extends object = {}> {
  children: ReactNode;
  hostId: string;
  options: HostOptions<THostSdk>;
}

export interface HostProviderState<THostSdk extends object> {
  options: HostOptions<THostSdk>;
  sdk: DomHostSdk<THostSdk>;
  anchors: AtlasHostAnchorRegistry;
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
