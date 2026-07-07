import type { AtlasHostRuntimeConfig } from "@atlas/contracts";
import { createAtlasSdk, type AtlasEventMap, type AtlasSdkOptions } from "@atlas/sdk";
import { createHostNavigation, type LocationLike, type RouterLike } from "@atlas/sdk/angular";
import { createAtlasOverlayController, createDomOverlayProviders } from "@atlas/sdk/overlay";
import type { AtlasNavigation } from "@atlas/sdk/navigation";
import { createHostUi, createRemoteTrustPolicy, createRetryPolicy, createTrustedNativeFederationImporters, createWidgetLoader, emitRuntimeEvent, loadBrowserRuntimeOverrides, loadHostCatalog, loadHostRuntimeConfig, resolveRuntimeManifests, startAtlasHostRuntime, type AtlasFederationAdapter, type AtlasHostMountEvent, type AtlasHostRuntime, type AtlasRuntimeObserver, type AtlasWidgetLoader } from "./index.js";

export interface HostOptions<TExtensions extends object = {}, THostData extends object = {}> extends Omit<AtlasSdkOptions<TExtensions, AtlasEventMap, THostData>, "hostId" | "navigation"> {
  router: RouterLike;
  location: LocationLike;
  federation: AtlasFederationAdapter;
  runtimeConfig?: AtlasHostRuntimeConfig;
  runtimeConfigUrl?: string;
  /** Explicitly enables URL and storage runtime overrides for local extension workflows. */
  allowRuntimeOverrides?: boolean;
  document?: Document;
  onStateChange?: (event: AtlasHostMountEvent) => void;
  renderLoading?: (container: HTMLElement, event: AtlasHostMountEvent) => void;
  renderError?: (container: HTMLElement, event: AtlasHostMountEvent, retry: () => void) => void;
  renderHostLoading?: (container: HTMLElement) => void | (() => void);
  renderHostError?: (container: HTMLElement, error: Error, retry: () => void) => void | (() => void);
  /** Receives provider-neutral runtime diagnostics. Observer errors are ignored. */
  observe?: AtlasRuntimeObserver;
}

/** Boots Atlas discovery, Native Federation, SDK providers, routes, slots, and lifecycle for an Angular host. */
export async function startHost<TExtensions extends object = {}, THostData extends object = {}>(options: HostOptions<TExtensions, THostData>): Promise<AtlasHostRuntime> {
  const startedAt = Date.now();
  emitRuntimeEvent(options.observe, { type: "host.start", timestamp: new Date().toISOString(), ...(options.runtimeConfig?.hostId ? { hostId: options.runtimeConfig.hostId } : {}) });
  const document = options.document ?? globalThis.document;
  const hostUi = createHostUi({
    document,
    ...(options.renderHostLoading ? { renderHostLoading: options.renderHostLoading } : {}),
    ...(options.renderHostError ? { renderHostError: options.renderHostError } : {})
  });
  hostUi.showLoading();
  try {
    const runtime = await startHostRuntime(options, document, hostUi.clear);
    hostUi.clear();
    emitRuntimeEvent(options.observe, {
      type: "host.ready",
      timestamp: new Date().toISOString(),
      hostId: runtime.hostId,
      durationMs: Date.now() - startedAt
    });
    return runtime;
  } catch (error) {
    const failure = toError(error);
    emitRuntimeEvent(options.observe, {
      type: "host.error",
      timestamp: new Date().toISOString(),
      ...(options.runtimeConfig?.hostId ? { hostId: options.runtimeConfig.hostId } : {}),
      durationMs: Date.now() - startedAt,
      error: failure
    });
    hostUi.showError(failure, () => { void startHost(options).catch(reportRetryFailure); });
    throw failure;
  }
}

async function startHostRuntime<TExtensions extends object, THostData extends object>(
  options: HostOptions<TExtensions, THostData>,
  document: Document,
  onInfrastructureReady: () => void
): Promise<AtlasHostRuntime> {
  const config = options.runtimeConfig ?? await loadHostRuntimeConfig(
    options.runtimeConfigUrl,
    undefined,
    options.observe ? { observer: options.observe } : undefined
  );
  const requestPolicy = createRetryPolicy(config, options.observe);
  const catalog = await loadHostCatalog({ catalogUrl: config.catalogUrl, requestPolicy });
  if (catalog.hostId !== config.hostId) {
    throw new Error(`Atlas catalog targets host "${catalog.hostId}", but runtime configuration targets "${config.hostId}".`);
  }
  const allowRuntimeOverrides = options.allowRuntimeOverrides ?? runtimeOverridesEnabled(config);
  const overrides = await loadBrowserRuntimeOverrides({ hostId: config.hostId, enabled: allowRuntimeOverrides, requestPolicy });
  const manifests = resolveRuntimeManifests(catalog, overrides);
  const trustPolicy = createRemoteTrustPolicy(config);
  const federation = await createTrustedNativeFederationImporters(options.federation, manifests, trustPolicy, requestPolicy);
  const browserLocation = globalThis.location;
  if (browserLocation) {
    const requestedUrl = `${browserLocation.pathname}${browserLocation.search}${browserLocation.hash}`;
    if (options.router.url !== requestedUrl) await options.router.navigateByUrl(requestedUrl, { replaceUrl: true });
  }
  const navigation = createHostNavigation(options.router, options.location);
  let widgetLoader: AtlasWidgetLoader | undefined;
  const defaults = createDomOverlayProviders(document);
  const overlays = createAtlasOverlayController({
    providers: {
      openModal: options.openModal ?? defaults.openModal,
      openPopup: options.openPopup ?? defaults.openPopup
    },
    getWidgetLoader: () => widgetLoader
  });
  const hostSdk = createAtlasSdk({
    hostId: config.hostId,
    ...(options.hostData ? { hostData: options.hostData } : {}),
    navigation,
    ...(options.eventBus ? { eventBus: options.eventBus } : {}),
    ...(options.getCurrentUser ? { getCurrentUser: options.getCurrentUser } : {}),
    ...(options.openToast ? { openToast: options.openToast } : {}),
    openModal: overlays.openModal,
    openPopup: overlays.openPopup,
    ...(options.getConfig ? { getConfig: options.getConfig } : {}),
    ...(options.httpClient ? { httpClient: options.httpClient } : {}),
    ...(options.extensions ? { extensions: options.extensions } : {})
  });
  widgetLoader = createWidgetLoader(manifests, hostSdk, federation.importComponent);
  renderAngularNavigation(document, manifests, config.hostId, navigation);
  onInfrastructureReady();
  let runtime: AtlasHostRuntime | undefined;
  runtime = await startAtlasHostRuntime({
    hostId: config.hostId,
    manifests,
    hostSdk,
    importRemote: federation.importRemote,
    importComponent: federation.importComponent,
    componentLoader: widgetLoader,
    trustPolicy,
    resolveRouteContainer: () => document.querySelector<HTMLElement>("[data-atlas-route-outlet]") ?? undefined,
    resolveSlotContainer: (_manifest, placement) => document.querySelector<HTMLElement>(`[data-atlas-slot="${cssEscape(placement.slot!)}"]`) ?? undefined,
    ...(config.loadTimeoutMs ? { loadTimeoutMs: config.loadTimeoutMs } : {}),
    ...(config.waitForMfReady !== undefined ? { waitForMfReady: config.waitForMfReady } : {}),
    onStateChange(event) {
      renderAngularMountState(document, event, config.loadingIndicator ?? "text", () => { void runtime?.retry(event.manifest.id); }, options);
      emitRuntimeEvent(options.observe, {
        type: "mf.state",
        timestamp: new Date().toISOString(),
        hostId: config.hostId,
        mfId: event.manifest.id,
        version: event.manifest.version,
        placementId: event.placement.id,
        state: event.state,
        ...(event.error ? { error: event.error } : {})
      });
      options.onStateChange?.(event);
    }
  });
  return runtime;
}

function runtimeOverridesEnabled(config: AtlasHostRuntimeConfig): boolean {
  return (config as AtlasHostRuntimeConfig & { allowRuntimeOverrides?: unknown }).allowRuntimeOverrides === true;
}

function reportRetryFailure(error: unknown): void {
  console.error("Atlas host retry failed", error);
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function renderAngularNavigation(document: Document, manifests: import("@atlas/contracts").AtlasManifest[], hostId: string, navigation: AtlasNavigation): void {
  const nav = document.querySelector<HTMLElement>("[data-atlas-navigation]");
  if (!nav) return;
  nav.replaceChildren(...manifests.flatMap((manifest) => manifest.placements
    .filter((placement) => placement.hostId === hostId && placement.kind === "route" && placement.route?.nav?.visible !== false)
    .sort((left, right) => (left.route?.nav?.order ?? 0) - (right.route?.nav?.order ?? 0))
    .map((placement) => {
      const link = document.createElement("a");
      link.href = navigation.createHref(placement.route!.basePath);
      link.textContent = placement.route!.nav?.label ?? placement.route!.title;
      link.addEventListener("click", (event) => { event.preventDefault(); navigation.navigate(placement.route!.basePath); });
      return link;
    })));
}

function renderAngularMountState(document: Document, event: AtlasHostMountEvent, indicator: "spinner" | "text" | "none", retry: () => void, options: HostOptions): void {
  const selector = event.placement.kind === "route"
    ? "[data-atlas-route-outlet]"
    : `[data-atlas-slot="${cssEscape(event.placement.slot!)}"]`;
  const container = document.querySelector<HTMLElement>(selector);
  if (!container) return;
  container.dataset.atlasState = event.state;
  container.setAttribute("aria-busy", event.state === "loading" ? "true" : "false");
  const existingStatus = container.querySelector<HTMLElement>("[data-atlas-status]");
  if (event.state === "mounting") existingStatus?.remove();
  if (event.state === "loading") {
    if (options.renderLoading) { options.renderLoading(container, event); return; }
    if (indicator === "none") { existingStatus?.remove(); return; }
    const status = existingStatus ?? document.createElement("div");
    status.dataset.atlasStatus = "";
    status.setAttribute("role", "status");
    status.replaceChildren();
    if (indicator === "spinner") {
      const spinner = document.createElement("span");
      spinner.dataset.atlasSpinner = "";
      spinner.setAttribute("aria-hidden", "true");
      status.append(spinner);
    }
    const label = document.createElement("span");
    label.textContent = `Loading ${event.manifest.name}...`;
    status.append(label);
    if (!existingStatus) container.prepend(status);
  }
  if (event.state === "error") {
    if (options.renderError) { options.renderError(container, event, retry); return; }
    const status = existingStatus ?? document.createElement("div");
    status.dataset.atlasStatus = "";
    status.setAttribute("role", "alert");
    status.replaceChildren();
    const message = document.createElement("span");
    message.textContent = `Unable to load ${event.manifest.name}. `;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Retry";
    button.addEventListener("click", retry);
    status.append(message, button);
    if (!existingStatus) container.prepend(status);
  }
  if (event.state === "mounted") existingStatus?.remove();
  if (event.state === "unmounted") container.replaceChildren();
}

function cssEscape(value: string): string {
  return globalThis.CSS?.escape ? globalThis.CSS.escape(value) : value.replace(/["\\]/g, "\\$&");
}
