import type { AtlasExportedWidgetManifest, AtlasManifest } from "@atlas/schema";
import { createAtlasSdk, type AtlasEventMap, type AtlasSdkOptions } from "@atlas/sdk";
import type { AtlasExportedWidgetEntry } from "@atlas/sdk/lifecycle";
import type { AtlasNavigation } from "@atlas/sdk/navigation";
import type { DomHostOptions } from "./dom-host-options.js";
import {
  createWidgetLoader,
  type AtlasWidgetLoader
} from "./index.js";

const NON_SDK_OPTION_NAMES = new Set([
  "allowAppOverrides", "document", "eventBus", "events", "federation", "hostData", "hostId", "httpClient",
  "location", "navigation", "observe", "onNavigationChange", "onStateChange", "renderError", "renderHostError",
  "renderHostLoading", "renderLoading", "router", "runtimeConfig", "runtimeConfigUrl"
]);

interface SdkProviderInput<THostSdk extends object> {
  options: DomHostOptions<THostSdk>;
  hostId: string;
  document: Document;
  navigation: AtlasNavigation;
  manifests: AtlasManifest[];
  importWidget: (widget: AtlasExportedWidgetManifest) => Promise<AtlasExportedWidgetEntry>;
}

export function createSdkProviders<THostSdk extends object>(
  input: SdkProviderInput<THostSdk>
): { sdk: ReturnType<typeof createAtlasSdk<THostSdk, AtlasEventMap>>; widgetLoader: AtlasWidgetLoader } {
  const sdkProperties = readSdkProperties(input.options);
  const sdkOptions = {
    hostId: input.hostId,
    ...(input.options.hostData ? { hostData: input.options.hostData } : {}),
    navigation: input.navigation,
    ...(input.options.eventBus ? { eventBus: input.options.eventBus } : {}),
    ...(input.options.httpClient ? { httpClient: input.options.httpClient } : {}),
    ...sdkProperties
  } as unknown as AtlasSdkOptions<THostSdk, AtlasEventMap>;
  const sdk = createAtlasSdk<THostSdk, AtlasEventMap>(sdkOptions);
  const widgetLoader = createWidgetLoader(input.manifests, sdk, input.importWidget);
  return { sdk, widgetLoader };
}

function readSdkProperties<THostSdk extends object>(options: DomHostOptions<THostSdk>): object {
  return Object.fromEntries(Object.entries(options).filter(([name]) => !NON_SDK_OPTION_NAMES.has(name)));
}
