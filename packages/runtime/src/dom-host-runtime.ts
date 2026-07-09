import type { AtlasHostRuntimeConfig } from "@atlas/schema";
import { emitMountState } from "./dom-host-events.js";
import type { DomHostOptions, DomHostServices } from "./dom-host-options.js";
import { createSdkProviders } from "./dom-host-sdk.js";
import { cssEscape, renderHostMountState, renderHostNavigation } from "./dom-rendering.js";
import { createHostNavigationItems, publishAtlasNavigationItems } from "./host-navigation.js";
import {
  createRemoteTrustPolicy,
  createRetryPolicy,
  createTrustedNativeFederationImporters,
  loadBrowserRuntimeOverrides,
  loadHostCatalog,
  loadHostRuntimeConfig,
  resolveRuntimeManifests,
  startAtlasHostRuntime,
  type AtlasHostRuntime
} from "./index.js";

interface DomHostRuntimeInput<TExtensions extends object, THostData extends object> {
  options: DomHostOptions<TExtensions, THostData>;
  services: DomHostServices;
  document: Document;
  onInfrastructureReady: () => void;
}

export async function startDomHostRuntime<TExtensions extends object, THostData extends object>(
  input: DomHostRuntimeInput<TExtensions, THostData>
): Promise<AtlasHostRuntime> {
  const { options, services, document, onInfrastructureReady } = input;
  const config = await resolveHostConfig(options);
  const requestPolicy = createRetryPolicy(config, options.observe);
  const catalog = await loadHostCatalog({ catalogUrl: config.catalogUrl, requestPolicy });
  assertCatalogMatchesConfig(catalog.hostId, config.hostId);

  const overrides = await loadBrowserRuntimeOverrides({
    hostId: config.hostId,
    enabled: options.allowAppOverrides ?? appOverridesEnabled(config),
    requestPolicy
  });
  const manifests = resolveRuntimeManifests(catalog, overrides);
  const trustPolicy = createRemoteTrustPolicy(config);
  const federation = await createTrustedNativeFederationImporters(options.federation, manifests, trustPolicy, requestPolicy);
  await services.beforeNavigation?.();
  const navigation = await services.createNavigation();
  const { sdk, widgetLoader } = createSdkProviders({
    options,
    hostId: config.hostId,
    document,
    navigation,
    manifests,
    importWidget: federation.importWidget
  });

  const updateNavigationItems = (): void => {
    const items = createHostNavigationItems(manifests, config.hostId, navigation);
    renderHostNavigation(document, items);
    publishAtlasNavigationItems(document, items);
    options.onNavigationChange?.(items);
  };
  updateNavigationItems();
  const stopNavigationItems = navigation.subscribe(updateNavigationItems);
  onInfrastructureReady();

  let runtime: AtlasHostRuntime | undefined;
  runtime = await startAtlasHostRuntime({
    hostId: config.hostId,
    manifests,
    sdk,
    importRemote: federation.importRemote,
    importWidget: federation.importWidget,
    widgetLoader,
    trustPolicy,
    resolveRouteContainer: () => document.querySelector<HTMLElement>("[data-atlas-route-outlet]") ?? undefined,
    resolveSlotContainer: (manifest, placement) => resolveDomSlotContainer(document, manifest.id, placement.id, placement.slot!),
    ...(config.resourcesTimeoutMs ? { resourcesTimeoutMs: config.resourcesTimeoutMs } : {}),
    onStateChange(event) {
      renderHostMountState(document, event, () => { void runtime?.retry(event.manifest.id); }, options);
      emitMountState(options.observe, config.hostId, event);
      options.onStateChange?.(event);
    }
  });
  return {
    hostId: runtime.hostId,
    manifests: runtime.manifests,
    retry: (mfId) => runtime.retry(mfId),
    async stop() {
      stopNavigationItems();
      await runtime.stop();
    }
  };
}

async function resolveHostConfig(options: DomHostOptions): Promise<AtlasHostRuntimeConfig> {
  return options.runtimeConfig ?? await loadHostRuntimeConfig(
    options.runtimeConfigUrl,
    undefined,
    options.observe ? { observer: options.observe } : undefined
  );
}

function appOverridesEnabled(config: AtlasHostRuntimeConfig): boolean {
  return config.allowAppOverrides !== false;
}

function assertCatalogMatchesConfig(catalogHostId: string, configHostId: string): void {
  if (catalogHostId !== configHostId) {
    throw new Error(`Atlas catalog targets host "${catalogHostId}", but runtime configuration targets "${configHostId}".`);
  }
}

function resolveDomSlotContainer(document: Document, mfId: string, placementId: string, slot: string): HTMLElement | undefined {
  const slotContainer = document.querySelector<HTMLElement>(`[data-atlas-slot="${cssEscape(slot)}"]`);
  if (!slotContainer) {
    console.warn(`Atlas app "${mfId}" declares slot placement "${placementId}" for host slot "${slot}", but the host DOM does not contain [data-atlas-slot="${slot}"]. Add <div data-atlas-slot="${slot}"></div> to the host layout or remove the slot placement from the app manifest.`);
    return undefined;
  }

  const key = `${mfId}:${placementId}`;
  const selector = `[data-atlas-slot-mount="${cssEscape(key)}"]`;
  const existing = slotContainer.querySelector<HTMLElement>(selector);
  if (existing) return existing;

  const container = document.createElement("div");
  container.dataset.atlasSlotMount = key;
  container.dataset.atlasMfId = mfId;
  container.dataset.atlasPlacementId = placementId;
  slotContainer.append(container);
  return container;
}
