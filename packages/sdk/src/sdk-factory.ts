import { createAtlasEventBus, type AtlasEventMap } from "./event-bus.js";
import { normalizeHttpClient } from "./http-client.js";
import { emptyModalOpener, missingConfigValue, missingPopupProvider, noop } from "./sdk-defaults.js";
import type { AtlasCoreSdk, AtlasHostData, AtlasSdk, AtlasSdkOptions } from "./sdk-types.js";

/** Creates the single host-owned SDK instance shared with mounted apps and widgets. */
export function createAtlasSdk<
  TExtensions extends object = {},
  TEvents extends object = AtlasEventMap,
  THostData extends object = {}
>(
  options: AtlasSdkOptions<TExtensions, TEvents, THostData>
): AtlasSdk<TExtensions, TEvents, THostData> {
  const core = createAtlasCoreSdk(options);
  assertExtensionsDoNotReplaceCore(options.extensions, core);
  return Object.assign(core, options.extensions ?? {}) as AtlasSdk<TExtensions, TEvents, THostData>;
}

function createAtlasCoreSdk<
  TExtensions extends object,
  TEvents extends object,
  THostData extends object
>(
  options: AtlasSdkOptions<TExtensions, TEvents, THostData>
): AtlasCoreSdk<THostData, TEvents> {
  return {
    hostId: options.hostId,
    hostData: createHostData(options),
    navigation: options.navigation,
    events: options.eventBus ?? createAtlasEventBus(),
    toast: { open: options.showToast ?? noop },
    modal: { open: options.openModal ?? emptyModalOpener },
    popup: { open: options.openPopup ?? missingPopupProvider },
    config: { get: options.getConfig ?? missingConfigValue },
    httpClient: normalizeHttpClient(options.httpClient)
  };
}

function createHostData<TExtensions extends object, TEvents extends object, THostData extends object>(
  options: AtlasSdkOptions<TExtensions, TEvents, THostData>
): AtlasHostData & Readonly<THostData> {
  return {
    ...(options.hostData ?? {}),
    hostId: options.hostId,
    name: options.hostData?.name ?? options.hostId
  } as AtlasHostData & Readonly<THostData>;
}

function assertExtensionsDoNotReplaceCore(extensions: object | undefined, core: object): void {
  if (!extensions) return;

  const reservedName = Object.keys(extensions).find((name) => name in core);
  if (reservedName) {
    throw new Error(`Atlas SDK extension "${reservedName}" conflicts with a core SDK capability.`);
  }
}
