import type { AtlasHostRuntimeConfig } from "@atlas/schema";
import type { AtlasSdkOptions } from "@atlas/sdk";
import type { AtlasNavigation } from "@atlas/sdk/navigation";
import type {
  AtlasFederationAdapter,
  AtlasHostMountEvent,
  AtlasRuntimeObserver
} from "./index.js";
import type { AtlasHostNavigationItem } from "./host-navigation.js";

export interface DomHostOptions<THostSdk extends object = {}>
  extends Omit<AtlasSdkOptions<THostSdk>, "hostId" | "navigation"> {
  federation: AtlasFederationAdapter;
  runtimeConfig?: AtlasHostRuntimeConfig;
  runtimeConfigUrl?: string;
  /** Enables URL and storage app overrides for Atlas tool workflows. */
  allowAppOverrides?: boolean;
  document?: Document;
  onNavigationChange?: (items: readonly AtlasHostNavigationItem[]) => void;
  onStateChange?: (event: AtlasHostMountEvent) => void;
  renderLoading?: (container: HTMLElement, event: AtlasHostMountEvent) => void;
  renderError?: (container: HTMLElement, event: AtlasHostMountEvent, retry: () => void) => void;
  renderHostLoading?: (container: HTMLElement) => void | (() => void);
  renderHostError?: (container: HTMLElement, error: Error, retry: () => void) => void | (() => void);
  /** Receives provider-neutral runtime diagnostics. Observer errors are ignored. */
  observe?: AtlasRuntimeObserver;
}

export interface DomHostServices {
  createNavigation(): AtlasNavigation | Promise<AtlasNavigation>;
  beforeNavigation?(): void | Promise<void>;
}
