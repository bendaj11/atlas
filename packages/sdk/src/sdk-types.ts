import type { AtlasNavigation } from "./navigation.js";
import type { AtlasOverlayContentMount } from "./overlay.js";
import type { AtlasEventBus, AtlasEventMap } from "./event-bus.js";
import type { AtlasHttpClient, AtlasHttpClientInput } from "./http-client.js";
import type { AtlasModalOpener, AtlasModalRequest, AtlasPopupRef, AtlasPopupRequest, AtlasToastRequest } from "./host-overlays.js";

export interface AtlasHostData {
  readonly hostId: string;
  readonly name: string;
}

/** Stable capabilities every host exposes to every mounted MF and widget. */
export interface AtlasCoreSdk<THostData extends object = {}, TEvents extends object = AtlasEventMap> {
  readonly hostId: string;
  readonly hostData: AtlasHostData & Readonly<THostData>;
  readonly navigation: AtlasNavigation;
  readonly events: AtlasEventBus<TEvents>;
  readonly toast: {
    open(request: AtlasToastRequest): void;
  };
  readonly modal: {
    open<TResult = unknown, TProps extends object = Record<string, unknown>>(request: AtlasModalRequest<TResult, TProps>): Promise<TResult | undefined>;
  };
  readonly popup: {
    open(request: AtlasPopupRequest): AtlasPopupRef;
  };
  readonly config: {
    get<TValue = unknown>(key: string): TValue | undefined;
  };
  readonly httpClient: AtlasHttpClient;
}

/** Core Atlas capabilities combined with host-specific, consumer-typed extensions. */
export type AtlasSdk<
  TExtensions extends object = {},
  TEvents extends object = AtlasEventMap,
  THostData extends object = {}
> = AtlasCoreSdk<THostData, TEvents> & Readonly<TExtensions>;

export interface AtlasSdkOptions<
  TExtensions extends object = {},
  TEvents extends object = AtlasEventMap,
  THostData extends object = {}
> {
  hostId: string;
  hostData?: THostData & AtlasHostData;
  navigation: AtlasNavigation;
  eventBus?: AtlasEventBus<TEvents>;
  showToast?: (request: AtlasToastRequest) => void;
  openModal?: AtlasModalOpener;
  openPopup?: (request: AtlasPopupRequest, content?: AtlasOverlayContentMount) => AtlasPopupRef;
  getConfig?: <TValue = unknown>(key: string) => TValue | undefined;
  httpClient?: AtlasHttpClientInput;
  extensions?: TExtensions;
}
