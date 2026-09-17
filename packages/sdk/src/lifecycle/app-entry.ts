import type {
  AtlasDeploymentCatalog,
  AtlasHostRuntimeConfig,
} from '@atlas/schema';
import type { AtlasSdk } from '../host.js';
import type { AtlasAppContext } from './app-context.js';

export interface AtlasAppMountRequest<THostSdk extends object = {}> {
  container: HTMLElement;
  /** Boundary where framework runtime styles must be inserted. */
  styleTarget: Node & ParentNode;
  sdk: AtlasSdk<THostSdk>;
  context: AtlasAppContext;
}

export interface AtlasAppMountResult {
  unmount?: () => void | Promise<void>;
}

export type AtlasMountOutcome<TResult extends AtlasAppMountResult> =
  void | TResult | Promise<void | TResult>;

/** Framework-neutral lifecycle contract exposed by every app remote entry. */
export interface AtlasAppEntry<THostSdk extends object = {}> {
  mount(
    request: AtlasAppMountRequest<THostSdk>,
  ): AtlasMountOutcome<AtlasAppMountResult>;
}

export interface AtlasHostMountRequest {
  container: HTMLElement;
  runtimeConfig: AtlasHostRuntimeConfig;
  catalog?: AtlasDeploymentCatalog;
}

/** Framework-neutral lifecycle exposed by every versioned host client. */
export interface AtlasHostClientEntry {
  mount(request: AtlasHostMountRequest): AtlasMountOutcome<AtlasAppMountResult>;
}
