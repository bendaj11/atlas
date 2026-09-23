import { assertAtlasHostCatalog } from '@atlas/schema';
import { startAtlasHostRuntime } from '../host-runtime/host-runtime.js';
import type { AtlasHostRuntime } from '../host-runtime/host-runtime.types.js';
import { resolveRuntimeCatalog } from '../loader/catalog/catalog-resolution.js';
import { loadHostDeployment } from '../loader/deployment/deployment.js';
import { AtlasCatalogHostMismatchError } from '../loader/loader.errors.js';
import { createTrustedNativeFederationImporters } from '../loader/native-federation.js';
import { loadBrowserRuntimeOverrides } from '../loader/overrides/overrides.js';
import { createRemoteTrustPolicy } from '../loader/trust/trust-policy.js';
import { createRetryPolicy } from '../resilience/resilience.js';
import { logBrowserError } from '../shared/errors.js';
import { createRegistryWidgetResolver } from '../widget-loader/widget-registry.js';
import { emitMountState } from './dom-host-events.js';
import { createSdkProviders } from './dom-host-sdk.js';
import { AtlasAppLoadError } from './dom-host.errors.js';
import type { DomHostRuntimeInput } from './dom-host.types.js';
import { renderHostMountState, renderHostNavigation } from './dom-rendering.js';
import { AtlasHostAnchorRegistry } from './host-anchors.js';
import {
  createHostNavigationItems,
  publishAtlasNavigationItems,
} from './host-navigation.js';

export async function startDomHostRuntime<THostSdk extends object>(
  input: DomHostRuntimeInput<THostSdk>,
): Promise<AtlasHostRuntime<THostSdk>> {
  const { options, services, document, onInfrastructureReady } = input;
  const anchors = options.anchors ?? new AtlasHostAnchorRegistry();
  const config = options.runtimeConfig;
  const requestPolicy = createRetryPolicy(config, options.observe);
  const catalog =
    options.catalog ??
    (await loadHostDeployment({
      manifestUrl: config.manifestUrl ?? buildDefaultManifestUrl(config),
      artifactRegistryUrl: config.artifactRegistryUrl,
      expectedHostId: config.hostId,
      expectedEnvironment: config.environment,
      requestPolicy,
    }));

  if (options.catalog) {
    assertAtlasHostCatalog(catalog);

    if (catalog.hostId !== config.hostId) {
      throw new AtlasCatalogHostMismatchError({
        catalogHostId: catalog.hostId,
        configuredHostId: config.hostId,
      });
    }
  }

  const overrides = options.catalog
    ? []
    : await loadBrowserRuntimeOverrides({
        hostId: config.hostId,
        requestPolicy,
      });
  const resolvedCatalog = resolveRuntimeCatalog(catalog, overrides);
  const manifests = resolvedCatalog.apps;
  const trustPolicy = createRemoteTrustPolicy(config);
  const federation = await createTrustedNativeFederationImporters({
    runtime: options.federation,
    manifests: [...manifests, ...(resolvedCatalog.widgetProviders ?? [])],
    policy: trustPolicy,
    requestPolicy,
    hostRemoteEntryUrl: catalog.host.remoteEntryUrl,
  });

  await services.beforeNavigation?.();

  const navigation = await services.createNavigation();
  const { sdk, widgetLoader } = createSdkProviders({
    options,
    hostId: config.hostId,
    navigation,
    manifests,
    importWidget: federation.importWidget,
    resolveWidget: createRegistryWidgetResolver({ catalog: resolvedCatalog }),
    trustPolicy,
  });

  services.onSdkCreated?.(sdk);

  const publishNavigationItems = () => {
    const items = createHostNavigationItems({
      manifests,
      hostId: config.hostId,
      navigation,
    });

    renderHostNavigation({ document, nav: anchors.get('navigation'), items });
    publishAtlasNavigationItems(document, items);

    options.onNavigationChange?.(items);
  };

  publishNavigationItems();

  const stopNavigationItems = navigation.subscribe(publishNavigationItems);

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
      findOrCreateSlotMountContainer({
        anchors,
        document,
        appId: manifest.id,
        placementId: placement.id,
        slot: placement.slot!,
      }),
    subscribeAnchors: (listener) => anchors.subscribe(listener),
    setActiveLayout: (layoutId) => anchors.setActiveLayout(layoutId),
    ...(config.resourcesTimeoutMs
      ? { resourcesTimeoutMs: config.resourcesTimeoutMs }
      : {}),
    onMountStateChange(event) {
      if (event.state === 'error' && event.error) {
        logBrowserError(
          `Atlas app "${event.manifest.id}" failed to load.`,
          new AtlasAppLoadError(event.manifest.id, event.error),
        );
      }

      renderHostMountState({
        document,
        event,
        retry: () => {
          void runtime?.retry(event.manifest.id);
        },
        options,
      });

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

function buildDefaultManifestUrl(config: {
  environmentRegistryUrl?: string;
  artifactRegistryUrl: string;
  environment: string;
  hostId: string;
}): string {
  const registryUrl =
    config.environmentRegistryUrl ?? config.artifactRegistryUrl;

  return `${registryUrl}/environments/${config.environment}/hosts/${config.hostId}/manifest.json`;
}

function findOrCreateSlotMountContainer(input: {
  anchors: AtlasHostAnchorRegistry;
  document: Document;
  appId: string;
  placementId: string;
  slot: string;
}): HTMLElement | undefined {
  const { anchors, document, appId, placementId, slot } = input;
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
