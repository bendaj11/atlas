import type { AtlasNavigation } from "./navigation.js";
import type { AtlasEventBus, AtlasEventMap } from "./event-bus.js";
import type { AtlasHttpClient, AtlasHttpClientInput } from "./http-client.js";

export interface AtlasMountedWidgetHandle {
  unmount(): Promise<void>;
}

/** Widget selected by UUID and mounted into a caller-owned card/container. */
export interface AtlasWidgetHandle {
  readonly id: string;
  readonly name: string;
  mount<TProps extends object = Record<string, unknown>>(
    container: HTMLElement,
    props: TProps
  ): Promise<AtlasMountedWidgetHandle>;
}

export type AtlasGetWidget = (widgetId: string) => Promise<AtlasWidgetHandle>;

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
  /** Resolve one exported widget by globally unique widget id. */
  readonly getWidget: AtlasGetWidget;
}

type HostDataOf<THostSdk extends object> = THostSdk extends { readonly hostData: infer THostData extends object }
  ? Omit<THostData, keyof AtlasHostData>
  : {};

type HostDataOption<THostSdk extends object> = keyof HostDataOf<THostSdk> extends never
  ? { hostData?: Partial<AtlasHostData> }
  : { hostData: HostDataOf<THostSdk> & Partial<AtlasHostData> };

type HostSdkProperties<THostSdk extends object> = Omit<
  THostSdk,
  "hostId" | "hostData" | "navigation" | "events" | "httpClient" | "getWidget"
>;

/** Atlas runtime capabilities combined with a host-owned, consumer-typed API. */
export type AtlasSdk<
  THostSdk extends object = {},
  TEvents extends object = AtlasEventMap
> = AtlasCoreSdk<HostDataOf<THostSdk>, TEvents> & Readonly<HostSdkProperties<THostSdk>>;

export type AtlasSdkOptions<
  THostSdk extends object = {},
  TEvents extends object = AtlasEventMap
> = {
  hostId: string;
  navigation: AtlasNavigation;
  eventBus?: AtlasEventBus<TEvents>;
  httpClient?: AtlasHttpClientInput;
} & HostDataOption<THostSdk> & HostSdkProperties<THostSdk>;
