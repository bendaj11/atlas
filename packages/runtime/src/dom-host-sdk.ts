import type { AtlasExportedWidgetManifest, AtlasManifest } from "@atlas/schema";
import { connectAtlasWidgetResolver, createAtlasSdk, type AtlasEventMap, type AtlasSdkOptions } from "@atlas/sdk";
import type { AtlasExportedWidgetEntry } from "@atlas/sdk/lifecycle";
import type { AtlasNavigation } from "@atlas/sdk/navigation";
import type { DomHostOptions } from "./dom-host-options.js";
import {
  createWidgetLoader,
  type AtlasRemoteTrustPolicy,
  type AtlasWidgetResolver,
  type AtlasWidgetLoader
} from "./index.js";

const NON_SDK_OPTION_NAMES = new Set([
  "allowAppOverrides", "catalog", "document", "eventBus", "events", "federation", "hostData", "hostId", "httpClient",
  "location", "navigation", "observe", "onNavigationChange", "renderError", "renderHostError",
  "renderHostLoading", "renderLoading", "renderWidgetError", "renderWidgetLoading", "router", "runtimeConfig",
  "runtimeConfigUrl", "sdk"
]);

interface SdkProviderInput<THostSdk extends object> {
  options: DomHostOptions<THostSdk>;
  hostId: string;
  document: Document;
  navigation: AtlasNavigation;
  manifests: AtlasManifest[];
  importWidget: (widget: AtlasExportedWidgetManifest) => Promise<AtlasExportedWidgetEntry>;
  resolveWidget?: AtlasWidgetResolver;
  trustPolicy?: AtlasRemoteTrustPolicy;
}

export function createSdkProviders<THostSdk extends object>(
  input: SdkProviderInput<THostSdk>
): { sdk: ReturnType<typeof createAtlasSdk<THostSdk, AtlasEventMap>>; widgetLoader: AtlasWidgetLoader } {
  const sdk = input.options.sdk ?? createDomHostSdk(input.options, input.hostId, input.navigation);
  const widgetLoader = createWidgetLoader(input.manifests, sdk, {
    importWidget: input.importWidget,
    ...(input.resolveWidget ? { resolveWidget: input.resolveWidget } : {}),
    ...(input.trustPolicy ? { trustPolicy: input.trustPolicy } : {}),
    ...(input.options.renderWidgetLoading ? { renderWidgetLoading: input.options.renderWidgetLoading } : {}),
    ...(input.options.renderWidgetError ? { renderWidgetError: input.options.renderWidgetError } : {})
  });
  connectAtlasWidgetResolver(sdk, widgetLoader.getWidget);
  return { sdk, widgetLoader };
}

export function createDomHostSdk<THostSdk extends object>(
  options: DomHostOptions<THostSdk>,
  hostId: string,
  navigation: AtlasNavigation
): ReturnType<typeof createAtlasSdk<THostSdk, AtlasEventMap>> {
  const sdkProperties = readSdkProperties(options);
  const sdkOptions = {
    hostId,
    ...(options.hostData ? { hostData: options.hostData } : {}),
    navigation,
    ...(options.eventBus ? { eventBus: options.eventBus } : {}),
    ...(options.httpClient ? { httpClient: options.httpClient } : {}),
    ...sdkProperties
  } as unknown as AtlasSdkOptions<THostSdk, AtlasEventMap>;
  return createAtlasSdk<THostSdk, AtlasEventMap>(sdkOptions);
}

function readSdkProperties<THostSdk extends object>(options: DomHostOptions<THostSdk>): object {
  return Object.fromEntries(Object.entries(options).filter(([name]) => !NON_SDK_OPTION_NAMES.has(name)));
}
