import { createAtlasEventBus, type AtlasEventMap } from "./event-bus.js";
import { normalizeHttpClient } from "./http-client.js";
import type { AtlasCoreSdk, AtlasGetWidget, AtlasGetWidgetOptions, AtlasHostData, AtlasSdk, AtlasSdkOptions, AtlasWidgetHandle } from "./sdk-types.js";

const widgetResolvers = new WeakMap<object, AtlasGetWidget>();

/** Creates the single host-owned SDK instance shared with mounted apps and widgets. */
export function createAtlasSdk<
  THostSdk extends object = {},
  TEvents extends object = AtlasEventMap
>(options: AtlasSdkOptions<THostSdk, TEvents>): AtlasSdk<THostSdk, TEvents> {
  const core = createAtlasCoreSdk(options);
  const sdkProperties = readSdkProperties(options);
  assertPropertiesDoNotReplaceCore(sdkProperties, core);
  return Object.assign(core, sdkProperties) as AtlasSdk<THostSdk, TEvents>;
}

function createAtlasCoreSdk<THostSdk extends object, TEvents extends object>(
  options: AtlasSdkOptions<THostSdk, TEvents>
): AtlasCoreSdk<object, TEvents> {
  const core: AtlasCoreSdk<object, TEvents> = {
    hostId: options.hostId,
    hostData: createHostData(options),
    navigation: options.navigation,
    events: options.eventBus ?? createAtlasEventBus<TEvents>(),
    httpClient: normalizeHttpClient(options.httpClient),
    getWidget: (widgetId, widgetOptions) => resolveWidget(core, widgetId, widgetOptions)
  };
  return core;
}

/** Connects host runtime widget discovery after SDK construction. */
export function connectAtlasWidgetResolver(sdk: object, resolver: AtlasGetWidget): void {
  widgetResolvers.set(sdk, resolver);
}

function resolveWidget<TInputs extends object>(
  sdk: object,
  widgetId: string,
  options?: AtlasGetWidgetOptions
): AtlasWidgetHandle<TInputs> {
  const resolver = widgetResolvers.get(sdk);
  if (!resolver) throw new Error("Atlas widget runtime is not ready.");
  return resolver<TInputs>(widgetId, options);
}

function createHostData<THostSdk extends object, TEvents extends object>(
  options: AtlasSdkOptions<THostSdk, TEvents>
): AtlasHostData & object {
  return {
    ...options.hostData,
    hostId: options.hostId,
    name: options.hostData?.name ?? options.hostId
  };
}

function readSdkProperties<THostSdk extends object, TEvents extends object>(
  options: AtlasSdkOptions<THostSdk, TEvents>
): object {
  const { hostId: _hostId, hostData: _hostData, navigation: _navigation, eventBus: _eventBus, httpClient: _httpClient, ...sdkProperties } = options;
  return sdkProperties;
}

function assertPropertiesDoNotReplaceCore(properties: object, core: object): void {
  const reservedName = Object.keys(properties).find((name) => name in core);
  if (reservedName) {
    throw new Error(`Atlas SDK property "${reservedName}" conflicts with a core SDK capability.`);
  }
}
