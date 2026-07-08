import type { AtlasExportedComponentManifest, AtlasManifest } from "@atlas/schema";
import { createAtlasSdk, type AtlasEventMap } from "@atlas/sdk";
import type { AtlasExportedComponentEntry } from "@atlas/sdk/lifecycle";
import type { AtlasNavigation } from "@atlas/sdk/navigation";
import { createAtlasOverlayController, createDomOverlayProviders } from "@atlas/sdk/overlay";
import type { DomHostOptions } from "./dom-host-options.js";
import {
  createWidgetLoader,
  type AtlasWidgetLoader
} from "./index.js";

interface SdkProviderInput<TExtensions extends object, THostData extends object> {
  options: DomHostOptions<TExtensions, THostData>;
  hostId: string;
  document: Document;
  navigation: AtlasNavigation;
  manifests: AtlasManifest[];
  importComponent: (component: AtlasExportedComponentManifest) => Promise<AtlasExportedComponentEntry>;
}

export function createSdkProviders<TExtensions extends object, THostData extends object>(
  input: SdkProviderInput<TExtensions, THostData>
): { sdk: ReturnType<typeof createAtlasSdk<TExtensions, AtlasEventMap, THostData>>; widgetLoader: AtlasWidgetLoader } {
  let widgetLoader: AtlasWidgetLoader | undefined;
  const defaults = createDomOverlayProviders(input.document);
  const overlays = createAtlasOverlayController({
    providers: {
      ...(input.options.openModal ? { openModal: input.options.openModal } : {}),
      openPopup: input.options.openPopup ?? defaults.openPopup
    },
    getWidgetLoader: () => widgetLoader
  });
  const sdk = createAtlasSdk({
    hostId: input.hostId,
    ...(input.options.hostData ? { hostData: input.options.hostData } : {}),
    navigation: input.navigation,
    ...(input.options.eventBus ? { eventBus: input.options.eventBus } : {}),
    ...(input.options.showToast ? { showToast: input.options.showToast } : {}),
    openModal: overlays.openModal,
    openPopup: overlays.openPopup,
    ...(input.options.getConfig ? { getConfig: input.options.getConfig } : {}),
    ...(input.options.httpClient ? { httpClient: input.options.httpClient } : {}),
    ...(input.options.extensions ? { extensions: input.options.extensions } : {})
  });
  widgetLoader = createWidgetLoader(input.manifests, sdk, input.importComponent);
  return { sdk, widgetLoader };
}
