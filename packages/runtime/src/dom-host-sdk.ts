import type { AtlasExportedWidgetManifest, AtlasManifest } from "@atlas/schema";
import { createAtlasSdk } from "@atlas/sdk";
import type { AtlasExportedWidgetEntry } from "@atlas/sdk/lifecycle";
import type { AtlasNavigation } from "@atlas/sdk/navigation";
import type { DomHostOptions } from "./dom-host-options.js";
import {
  createWidgetLoader,
  type AtlasWidgetLoader
} from "./index.js";

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
): { sdk: ReturnType<typeof createAtlasSdk<THostSdk>>; widgetLoader: AtlasWidgetLoader } {
  const sdk = createAtlasSdk({
    hostId: input.hostId,
    ...(input.options.hostData ? { hostData: input.options.hostData } : {}),
    navigation: input.navigation,
    ...(input.options.eventBus ? { eventBus: input.options.eventBus } : {}),
    ...(input.options.httpClient ? { httpClient: input.options.httpClient } : {}),
    ...(input.options.extensions ? { extensions: input.options.extensions } : {})
  });
  const widgetLoader = createWidgetLoader(input.manifests, sdk, input.importWidget);
  return { sdk, widgetLoader };
}
