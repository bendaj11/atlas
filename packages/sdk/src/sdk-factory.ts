import { createAtlasEventBus, type AtlasEventMap } from "./event-bus.js";
import { normalizeHttpClient } from "./http-client.js";
import type { AtlasCoreSdk, AtlasHostData, AtlasSdk, AtlasSdkOptions } from "./sdk-types.js";

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
  return {
    hostId: options.hostId,
    hostData: createHostData(options),
    navigation: options.navigation,
    events: options.eventBus ?? createAtlasEventBus<TEvents>(),
    httpClient: normalizeHttpClient(options.httpClient)
  };
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
