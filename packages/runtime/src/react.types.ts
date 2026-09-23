import type { ReactNode } from 'react';
import type { RouterLike } from '@atlas/sdk/react';
import type {
  DomHostOptions,
  DomRuntimeOptions,
} from './dom-host/dom-host.types.js';
import type { DomHostSdk } from './dom-host/dom-host-sdk.types.js';
import type { AtlasHostAnchorRegistry } from './dom-host/host-anchors.js';

export type HostOptions<THostSdk extends object = {}> =
  DomHostOptions<THostSdk> & {
    router: RouterLike;
  };

/** Product SDK configuration supplied to a React Atlas host. */
export type HostSdkOptions<THostSdk extends object = {}> = Omit<
  HostOptions<THostSdk>,
  keyof DomRuntimeOptions | 'router' | 'navigation' | 'sdk'
> &
  Pick<HostOptions<THostSdk>, 'observe'>;

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
