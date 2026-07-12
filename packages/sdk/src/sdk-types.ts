import type { AtlasNavigation } from "./navigation.js";
import type { AtlasEventBus, AtlasEventMap } from "./event-bus.js";
import type { AtlasHttpClient, AtlasHttpClientInput } from "./http-client.js";

export interface AtlasHostData {
  readonly hostId: string;
  readonly name: string;
}

/** Stable capabilities every host exposes to every mounted app and widget. */
export interface AtlasCoreSdk<THostData extends object = {}, TEvents extends object = AtlasEventMap> {
  readonly hostId: string;
  readonly hostData: AtlasHostData & Readonly<THostData>;
  readonly navigation: AtlasNavigation;
  readonly events: AtlasEventBus<TEvents>;
  readonly httpClient: AtlasHttpClient;
}

/** Atlas runtime capabilities combined with a host-owned, consumer-typed API. */
export type AtlasSdk<
  THostSdk extends object = {},
  TEvents extends object = AtlasEventMap,
  THostData extends object = {}
> = AtlasCoreSdk<THostData, TEvents> & Readonly<THostSdk>;

export interface AtlasSdkOptions<
  THostSdk extends object = {},
  TEvents extends object = AtlasEventMap,
  THostData extends object = {}
> {
  hostId: string;
  hostData?: THostData & Partial<AtlasHostData>;
  navigation: AtlasNavigation;
  eventBus?: AtlasEventBus<TEvents>;
  httpClient?: AtlasHttpClientInput;
  extensions?: THostSdk;
}
