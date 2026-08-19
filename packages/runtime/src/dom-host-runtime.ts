import {
  assertAtlasHostCatalog,
  type AtlasHostRuntimeConfig,
} from '@atlas/schema';
import { createBrowserError, logBrowserError } from './browser-error.js';
import { runtimeError } from './runtime-error.js';
import { emitMountState } from './dom-host-events.js';
import type {
  DomHostOptions,
  DomHostServices,
  DomRuntimeOptions,
} from './dom-host-options.js';
import { createSdkProviders } from './dom-host-sdk.js';
import { renderHostMountState, renderHostNavigation } from './dom-rendering.js';
import { AtlasHostAnchorRegistry } from './host-anchors.js';
import {
  createHostNavigationItems,
  publishAtlasNavigationItems,
} from './host-navigation.js';
import {
  createRemoteTrustPolicy,
  createRegistryWidgetResolver,
  createRetryPolicy,
  createTrustedNativeFederationImporters,
  loadBrowserRuntimeOverrides,
  loadHostCatalog,
  loadHostRuntimeConfig,
  resolveRuntimeCatalog,
  startAtlasHostRuntime,
  type AtlasHostRuntime,
} from './index.js';

interface DomHostRuntimeInput<THostSdk extends object> {
  options: DomHostOptions<THostSdk>;
  services: DomHostServices<THostSdk>;
  document: Document;
  onInfrastructureReady: () => void;
}

export async function startDomHostRuntime<THostSdk extends object>(
  input: DomHostRuntimeInput<THostSdk>,
): Promise<AtlasHostRuntime<THostSdk>> {
  const { options, services, document, onInfrastructureReady } = input;
  const anchors = options.anchors ?? new AtlasHostAnchorRegistry();
  const config = await resolveHostConfig(options);
  const requestPolicy = createRetryPolicy(config, options.observe);
  const catalog =
    options.catalog ??
    (await loadHostCatalog({ catalogUrl: config.catalogUrl, requestPolicy }));
  if (options.catalog) assertAtlasHostCatalog(catalog);
  assertCatalogMatchesConfig(catalog.hostId, config.hostId);

  const allowCustomOverrides =
    options.allowAppOverrides ?? config.allowCustomOverrides;
  const overrides = options.catalog
    ? []
    : await loadBrowserRuntimeOverrides({
        hostId: config.hostId,
        ...(allowCustomOverrides !== undefined ? { allowCustomOverrides } : {}),
        requestPolicy,
      });
  const resolvedCatalog = resolveRuntimeCatalog(catalog, overrides);
  const manifests = resolvedCatalog.apps;
  const federationManifests = [
    ...manifests,
    ...(resolvedCatalog.widgetProviders ?? []),
  ];
  const trustPolicy = createRemoteTrustPolicy(config);
  const federation = await createTrustedNativeFederationImporters(
    options.federation,
    federationManifests,
    trustPolicy,
    requestPolicy,
    catalog.host.remoteEntryUrl,
  );
  await services.beforeNavigation?.();
  const navigation = await services.createNavigation();
  const { sdk, widgetLoader } = createSdkProviders({
    options,
    hostId: config.hostId,
    document,
    navigation,
    manifests,
    importWidget: federation.importWidget,
    resolveWidget: createRegistryWidgetResolver({
      runtimeConfig: config,
      catalog: resolvedCatalog,
    }),
    trustPolicy,
  });
  services.onSdkCreated?.(sdk);

  const updateNavigationItems = (): void => {
    const items = createHostNavigationItems(
      manifests,
      config.hostId,
      navigation,
    );
    renderHostNavigation(document, anchors.get('navigation'), items);
    publishAtlasNavigationItems(document, items);
    options.onNavigationChange?.(items);
  };
  updateNavigationItems();
  const stopNavigationItems = navigation.subscribe(updateNavigationItems);
  onInfrastructureReady();

  let runtime: AtlasHostRuntime<THostSdk> | undefined;
  runtime = await startAtlasHostRuntime({
    hostId: config.hostId,
    manifests,
    sdk,
    importRemote: federation.importRemote,
    importWidget: federation.importWidget,
    widgetLoader,
    trustPolicy,
    resolveRouteContainer: () => anchors.get('route-outlet'),
    resolveSlotContainer: (manifest, placement) =>
      resolveDomSlotContainer(
        anchors,
        document,
        manifest.id,
        placement.id,
        placement.slot!,
      ),
    subscribeAnchors: (listener) => anchors.subscribe(listener),
    setActiveLayout: (layoutId) => anchors.setActiveLayout(layoutId),
    ...(config.resourcesTimeoutMs
      ? { resourcesTimeoutMs: config.resourcesTimeoutMs }
      : {}),
    onMountStateChange(event) {
      if (event.state === 'error' && event.error) {
        logBrowserError(
          `Atlas app "${event.manifest.id}" failed to load.`,
          createBrowserError(event.error, {
            summary: `Atlas could not load app "${event.manifest.id}"`,
            suggestedActions: [
              'Verify the app remote entry URL is deployed, reachable, and allowed by the host CORS and asset-origin policy.',
              'Correct the app build or host catalog, then use Retry in the page.',
            ],
            code: 'ATLAS_APP_LOAD_FAILED',
          }),
        );
      }
      renderHostMountState(
        document,
        event,
        () => {
          void runtime?.retry(event.manifest.id);
        },
        options,
      );
      emitMountState(options.observe, config.hostId, event);
    },
  });
  return {
    hostId: runtime.hostId,
    manifests: runtime.manifests,
    retry: (appId) => runtime.retry(appId),
    updateHostData: (updates) => runtime.updateHostData(updates),
    async stop() {
      stopNavigationItems();
      await runtime.stop();
    },
  };
}

async function resolveHostConfig(
  options: DomRuntimeOptions,
): Promise<AtlasHostRuntimeConfig> {
  return (
    options.runtimeConfig ??
    (await loadHostRuntimeConfig(
      options.runtimeConfigUrl,
      undefined,
      options.observe ? { observer: options.observe } : undefined,
    ))
  );
}

function assertCatalogMatchesConfig(
  catalogHostId: string,
  configHostId: string,
): void {
  if (catalogHostId !== configHostId) {
    throw runtimeError(
      `Atlas cannot start host "${configHostId}" because its catalog belongs to host "${catalogHostId}".`,
      {
        suggestedActions:
          'Point atlas.runtime.json catalogUrl to the catalog for this host, then reload the page.',
        code: 'ATLAS_CATALOG_HOST_MISMATCH',
      },
    );
  }
}

function resolveDomSlotContainer(
  anchors: AtlasHostAnchorRegistry,
  document: Document,
  appId: string,
  placementId: string,
  slot: string,
): HTMLElement | undefined {
  const slotContainer = anchors.get('slot', slot);
  if (!slotContainer) return undefined;

  const key = `${appId}:${placementId}`;
  const existing = slotContainer.querySelector<HTMLElement>(
    `[data-atlas-slot-mount="${key}"]`,
  );
  if (existing) return existing;

  const container = document.createElement('div');
  container.dataset.atlasSlotMount = key;
  container.dataset.atlasAppId = appId;
  container.dataset.atlasPlacementId = placementId;
  slotContainer.append(container);
  return container;
}
