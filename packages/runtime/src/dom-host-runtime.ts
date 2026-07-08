import type { AtlasHostRuntimeConfig } from "@atlas/schema";
import { emitMountState } from "./dom-host-events.js";
import type { DomHostOptions, DomHostServices } from "./dom-host-options.js";
import { createSdkProviders } from "./dom-host-sdk.js";
import { cssEscape, renderHostMountState, renderHostNavigation } from "./dom-rendering.js";
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
    importComponent: federation.importComponent
  });

  renderHostNavigation(document, manifests, config.hostId, navigation);
  onInfrastructureReady();

  let runtime: AtlasHostRuntime | undefined;
  runtime = await startAtlasHostRuntime({
    hostId: config.hostId,
    manifests,
    sdk,
    importRemote: federation.importRemote,
    importComponent: federation.importComponent,
    widgetLoader,
    trustPolicy,
    resolveRouteContainer: () => document.querySelector<HTMLElement>("[data-atlas-route-outlet]") ?? undefined,
    resolveSlotContainer: (_manifest, placement) => document.querySelector<HTMLElement>(`[data-atlas-slot="${cssEscape(placement.slot!)}"]`) ?? undefined,
    ...(config.resourcesTimeoutMs ? { resourcesTimeoutMs: config.resourcesTimeoutMs } : {}),
    onStateChange(event) {
      renderHostMountState(document, event, () => { void runtime?.retry(event.manifest.id); }, options);
      emitMountState(options.observe, config.hostId, event);
      options.onStateChange?.(event);
    }
  });
  return runtime;
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
