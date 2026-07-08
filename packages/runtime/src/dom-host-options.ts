import type { AtlasHostRuntimeConfig } from "@atlas/schema";
import type { AtlasEventMap, AtlasHostData, AtlasSdkOptions } from "@atlas/sdk";
import type { AtlasNavigation } from "@atlas/sdk/navigation";
import type { AtlasModalProvider, AtlasOverlayProviders } from "@atlas/sdk/overlay";
import type {
  AtlasFederationAdapter,
  AtlasHostMountEvent,
  AtlasRuntimeObserver
} from "./index.js";

type AtlasPopupProvider = Required<AtlasOverlayProviders>["openPopup"];

export interface DomHostOptions<TExtensions extends object = {}, THostData extends object = {}>
  extends Omit<AtlasSdkOptions<TExtensions, AtlasEventMap, THostData>, "hostId" | "navigation" | "hostData" | "openModal" | "openPopup"> {
  federation: AtlasFederationAdapter;
  hostData?: THostData & AtlasHostData;
  openModal: AtlasModalProvider;
  openPopup: AtlasPopupProvider;
  runtimeConfig?: AtlasHostRuntimeConfig;
  runtimeConfigUrl?: string;
  /** Enables URL and storage app overrides for Atlas tool workflows. */
  allowAppOverrides?: boolean;
  document?: Document;
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
