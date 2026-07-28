import type { AtlasHostCatalog, AtlasHostRuntimeConfig } from "@atlas/schema";
import type { AtlasEventMap, AtlasSdk, AtlasSdkOptions } from "@atlas/sdk";
import type { AtlasNavigation } from "@atlas/sdk/navigation";
import type {
  AtlasFederationAdapter,
  AtlasHostMountEvent,
  AtlasRuntimeObserver,
  AtlasWidgetUiOptions
} from "./index.js";
import type { AtlasHostNavigationItem } from "./host-navigation.js";
import type { AtlasHostAnchorRegistry } from "./host-anchors.js";

export interface DomRuntimeOptions extends AtlasWidgetUiOptions {
  federation: AtlasFederationAdapter;
  runtimeConfig?: AtlasHostRuntimeConfig;
  /** Already-resolved catalog supplied by the stable Atlas loader. */
  catalog?: AtlasHostCatalog;
  runtimeConfigUrl?: string;
  /** Enables URL and storage app overrides for Atlas tool workflows. */
  allowAppOverrides?: boolean;
  document?: Document;
  /** Native Angular or React anchors used as Atlas render targets. */
  anchors?: AtlasHostAnchorRegistry;
  onNavigationChange?: (items: readonly AtlasHostNavigationItem[]) => void;
  renderLoading?: (container: HTMLElement, event: AtlasHostMountEvent) => void;
  renderError?: (container: HTMLElement, event: AtlasHostMountEvent, retry: () => void) => void;
  renderHostLoading?: (container: HTMLElement) => void | (() => void);
  renderHostError?: (container: HTMLElement, error: Error, retry: () => void) => void | (() => void);
  /** Receives provider-neutral runtime diagnostics. Observer errors are ignored. */
  observe?: AtlasRuntimeObserver;
}

export type DomHostOptions<THostSdk extends object = {}> = Omit<
  AtlasSdkOptions<THostSdk, AtlasEventMap>,
  "hostId" | "navigation"
> & DomRuntimeOptions & {
  sdk?: AtlasSdk<THostSdk, AtlasEventMap>;
  navigation?: AtlasNavigation;
};

export interface DomHostServices {
  createNavigation(): AtlasNavigation | Promise<AtlasNavigation>;
  beforeNavigation?(): void | Promise<void>;
}
