import type { AtlasNavigation } from "./navigation.js";
import type { AtlasEventBus, AtlasEventMap } from "./event-bus.js";
import type { AtlasHttpClient, AtlasHttpClientInput } from "./http-client.js";

export interface AtlasMountedWidgetHandle<TInputs extends object = Record<string, unknown>> {
  setInputs?(inputs: TInputs): void;
  unmount(): Promise<void>;
}

export type AtlasWidgetLoadingRenderer = (container: HTMLElement) => void | (() => void);

export interface AtlasGetWidgetOptions {
  renderLoading?: AtlasWidgetLoadingRenderer;
}

/** Widget selected by UUID and mounted into a caller-owned card/container. */
export interface AtlasWidgetHandle<TInputs extends object = Record<string, unknown>> {
  readonly id: string;
  readonly name: string;
  mount(
    container: HTMLElement,
    inputs: TInputs
  ): Promise<AtlasMountedWidgetHandle<TInputs>>;
}

export type AtlasGetWidget = <TInputs extends object = Record<string, unknown>>(
  widgetId: string,
  options?: AtlasGetWidgetOptions
) => AtlasWidgetHandle<TInputs>;

export interface AtlasHostData {
  readonly hostId: string;
  readonly name: string;
}

/** Values Atlas can safely carry between apps in the destination URL. */
export type AtlasNavigationState = Readonly<Record<string, string | number | boolean | null | undefined>>;

/** Stable capabilities every host exposes to every mounted app and widget. */
export interface AtlasCoreSdk<THostData extends object = {}, TEvents extends object = AtlasEventMap> {
  readonly hostId: string;
  readonly hostData: AtlasHostData & Readonly<THostData>;
  /** Navigate to a selected app or host headless app by its stable id. */
  navigateTo(appId: string, state?: AtlasNavigationState): void;
  /**
   * Typed, in-memory events shared by mounted apps in this host.
   * Use `emit()` to dispatch and `addEventListener()` / `removeEventListener()` for lifecycle-managed listeners.
   */
  readonly events: AtlasEventBus<TEvents>;
  readonly httpClient: AtlasHttpClient;
  /** Resolve one exported widget by globally unique widget id. */
  readonly getWidget: AtlasGetWidget;
}

export type AtlasHostDataOf<THostSdk extends object> = THostSdk extends { readonly hostData: infer THostData extends object }
  ? Omit<THostData, keyof AtlasHostData>
  : {};

export type AtlasHostDataValue<THostSdk extends object> = AtlasHostData & Readonly<AtlasHostDataOf<THostSdk>>;

type HostDataOption<THostSdk extends object> = keyof AtlasHostDataOf<THostSdk> extends never
  ? { hostData?: Partial<AtlasHostData> }
  : { hostData: AtlasHostDataOf<THostSdk> & Partial<AtlasHostData> };

type HostSdkProperties<THostSdk extends object> = Omit<
  THostSdk,
  "hostId" | "hostData" | "navigation" | "events" | "httpClient" | "getWidget"
>;

/** Atlas runtime capabilities combined with a host-owned, consumer-typed API. */
export type AtlasSdk<
  THostSdk extends object = {},
  TEvents extends object = AtlasEventMap
> = AtlasCoreSdk<AtlasHostDataOf<THostSdk>, TEvents> & Readonly<HostSdkProperties<THostSdk>>;

export type AtlasSdkOptions<
  THostSdk extends object = {},
  TEvents extends object = AtlasEventMap
> = {
  hostId: string;
  navigation: AtlasNavigation;
  eventBus?: AtlasEventBus<TEvents>;
  httpClient?: AtlasHttpClientInput;
} & HostDataOption<THostSdk> & HostSdkProperties<THostSdk>;
