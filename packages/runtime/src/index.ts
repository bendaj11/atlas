import type { AtlasExportedWidgetManifest, AtlasManifest, AtlasPlacement } from "@atlas/schema";
import type { AtlasSdk, AtlasWidgetHandle } from "@atlas/sdk/host";
import type {
  AtlasExportedWidgetEntry,
  AtlasAppEntry,
  AtlasAppMountResult,
  AtlasMountedWidget,
  AtlasWidgetLoader
} from "@atlas/sdk/lifecycle";
import { createRouteContext, createScopedNavigation } from "@atlas/sdk/navigation";
import { assertManifestAssetTrust, loadHostCatalog, resolveRuntimeManifests, verifyManifestIntegrity, type AtlasRemoteTrustPolicy, type AtlasRuntimeOverride } from "./loader/runtime-discovery.js";
import { importNativeFederationRemote } from "./loader/native-federation.js";
import { startRemoteAssetRewrite } from "./remote-assets.js";
import { loadManifestStyles } from "./stylesheets.js";
import { mapWithConcurrency } from "./concurrency.js";
import type { AtlasResolvedWidget, AtlasWidgetResolver } from "./widget-registry.js";
export { createRegistryWidgetResolver, type AtlasResolvedWidget, type AtlasWidgetResolver } from "./widget-registry.js";
export { AtlasLoadError, createRetryPolicy, runResiliently, type AtlasOperationContext, type AtlasRetryPolicy, type AtlasRetryPolicySource } from "./resilience.js";
export { createHostUi, type AtlasHostUi, type AtlasHostUiOptions } from "./host-ui.js";
export {
  emitRuntimeEvent,
  type AtlasHostEvent,
  type AtlasAppEvent,
  type AtlasOperationEvent,
  type AtlasRuntimeEvent,
  type AtlasRuntimeObserver
} from "./observability.js";
export { loadManifestStyles, type AtlasStyleRelease } from "./stylesheets.js";
export {
  ATLAS_NAVIGATION_ITEMS_EVENT,
  createHostNavigationItems,
  publishAtlasNavigationItems,
  readAtlasNavigationItems,
  subscribeAtlasNavigationItems,
  type AtlasHostNavigationItem
} from "./host-navigation.js";
export {
  createNativeFederationImporters,
  createTrustedNativeFederationImporters,
  importNativeFederationRemote,
  type AtlasFederationAdapter,
  type AtlasNativeFederationImporters
} from "./loader/native-federation.js";
export { rewriteAssetUrl, rewriteCssAssetUrls, startRemoteAssetRewrite, type AtlasAssetRewriteRelease } from "./remote-assets.js";
export {
  ATLAS_OVERRIDE_DOCUMENT_STORAGE_KEY,
  ATLAS_OVERRIDE_QUERY_PARAM,
  ATLAS_OVERRIDE_STORAGE_KEY,
  loadBrowserRuntimeOverrides,
  createRemoteTrustPolicy,
  assertManifestAssetTrust,
  assertManifestStylesTrust,
  findManifestTrustErrors,
  loadHostCatalog,
  loadHostRuntimeConfig,
  resolveRuntimeManifests,
  verifyManifestIntegrity,
  type AtlasBrowserOverrideOptions,
  type AtlasRemoteTrustPolicy,
  type AtlasRuntimeOverride,
  type AtlasRuntimeOverrideDocument
} from "./loader/runtime-discovery.js";

export type {
  AtlasExportedWidgetEntry,
  AtlasExportedWidgetMountRequest,
  AtlasAppContext,
  AtlasAppEntry,
  AtlasAppMountRequest,
  AtlasAppMountResult,
  AtlasMountedWidget,
  AtlasWidgetLoader
} from "@atlas/sdk/lifecycle";

export interface AtlasWidgetRenderContext {
  widgetId: string;
  widget?: AtlasExportedWidgetManifest;
  ownerManifest?: AtlasManifest;
}

export interface AtlasWidgetErrorRenderContext extends AtlasWidgetRenderContext {
  error: Error;
}

export interface AtlasWidgetUiOptions {
  renderWidgetLoading?: (
    container: HTMLElement,
    context: AtlasWidgetRenderContext
  ) => void | (() => void);
  renderWidgetError?: (
    container: HTMLElement,
    context: AtlasWidgetErrorRenderContext,
    retry: () => void
  ) => void | (() => void);
}

export interface AtlasWidgetLoaderOptions extends AtlasWidgetUiOptions {
  importWidget?: (widget: AtlasExportedWidgetManifest) => Promise<AtlasExportedWidgetEntry>;
  resolveWidget?: AtlasWidgetResolver;
  trustPolicy?: AtlasRemoteTrustPolicy;
}

export interface AtlasLoaderOptions extends AtlasWidgetUiOptions {
  hostId: string;
  catalogUrl: string;
  sdk: AtlasSdk;
  fetchJson?: <T>(url: string) => Promise<T>;
  importRemote?: (manifest: AtlasManifest) => Promise<AtlasAppEntry>;
  overrides?: AtlasRuntimeOverride[];
  importWidget?: (widget: AtlasExportedWidgetManifest) => Promise<AtlasExportedWidgetEntry>;
  widgetLoader?: AtlasWidgetLoader;
  trustPolicy?: AtlasRemoteTrustPolicy;
}

export interface AtlasMountedApp {
  manifest: AtlasManifest;
  unmount(): Promise<void>;
}

export type AtlasHostMountState = "mounting" | "loading" | "mounted" | "error" | "unmounted";

export interface AtlasHostMountEvent {
  manifest: AtlasManifest;
  placement: AtlasPlacement;
  state: AtlasHostMountState;
  error?: Error;
}

export interface AtlasHostRuntimeOptions extends AtlasWidgetUiOptions {
  hostId: string;
  manifests: AtlasManifest[];
  sdk: AtlasSdk;
  importRemote: (manifest: AtlasManifest) => Promise<AtlasAppEntry>;
  importWidget?: (widget: AtlasExportedWidgetManifest) => Promise<AtlasExportedWidgetEntry>;
  widgetLoader?: AtlasWidgetLoader;
  resolveRouteContainer(manifest: AtlasManifest, placement: AtlasPlacement): HTMLElement | undefined;
  resolveSlotContainer(manifest: AtlasManifest, placement: AtlasPlacement): HTMLElement | undefined;
  onStateChange?: (event: AtlasHostMountEvent) => void;
  resourcesTimeoutMs?: number;
  trustPolicy?: AtlasRemoteTrustPolicy;
}

export interface AtlasHostRuntime {
  readonly hostId: string;
  readonly manifests: AtlasManifest[];
  retry(appId: string): Promise<void>;
  stop(): Promise<void>;
}

interface RuntimeMount {
  key: string;
  manifest: AtlasManifest;
  placement: AtlasPlacement;
  container: HTMLElement;
  mounted?: AtlasMountedApp;
  pending?: Promise<void>;
  generation: number;
}

interface RuntimePlacement {
  manifest: AtlasManifest;
  placement: AtlasPlacement;
}

const DEFAULT_RUNTIME_TIMEOUT_MS = 15_000;

/** Owns catalog placement lifecycle while the framework adapter owns browser navigation. */
export async function startAtlasHostRuntime(options: AtlasHostRuntimeOptions): Promise<AtlasHostRuntime> {
  const widgetLoader = options.widgetLoader ?? createWidgetLoader(options.manifests, options.sdk, {
    ...(options.importWidget ? { importWidget: options.importWidget } : {}),
    ...(options.trustPolicy ? { trustPolicy: options.trustPolicy } : {}),
    ...(options.renderWidgetLoading ? { renderWidgetLoading: options.renderWidgetLoading } : {}),
    ...(options.renderWidgetError ? { renderWidgetError: options.renderWidgetError } : {})
  });
  const placements = hostPlacements(options.manifests, options.hostId);
  const routePlacements = placements.filter(({ placement }) => placement.kind === "route" && placement.route);
  const slotPlacements = placements.filter(({ placement }) => placement.kind === "slot" && placement.slot);
  const routePlan = createRoutePlacementPlan(routePlacements);
  for (const conflict of routePlan.conflicts) {
    logRouteConflict(options.hostId, conflict);
  }
  const controller = new AtlasRuntimeController(options, widgetLoader, routePlan.available);

  await controller.mountSlots(slotPlacements);
  await controller.reconcileRoute(options.sdk.navigation.getCurrentLocation().pathname);
  const unsubscribe = options.sdk.navigation.subscribe((location) => {
    controller.enqueueRouteReconcile(location.pathname);
  });

  return {
    hostId: options.hostId,
    manifests: options.manifests,
    retry: (appId) => controller.retry(appId),
    stop: () => controller.stop(unsubscribe)
  };
}

class AtlasRuntimeController {
  private readonly mounts = new Map<string, RuntimeMount>();
  private readonly timeoutMs: number;
  private routeKey: string | undefined;
  private stopped = false;
  private queue = Promise.resolve();

  constructor(
    private readonly options: AtlasHostRuntimeOptions,
    private readonly widgetLoader: AtlasWidgetLoader,
    private readonly routePlacements: RuntimePlacement[]
  ) {
    this.timeoutMs = options.resourcesTimeoutMs ?? DEFAULT_RUNTIME_TIMEOUT_MS;
  }

  async mountSlots(slotPlacements: RuntimePlacement[]): Promise<void> {
    await mapWithConcurrency(slotPlacements, async (selected) => {
      const container = this.options.resolveSlotContainer(selected.manifest, selected.placement);
      if (container) await this.mountOne(createRuntimeMount(selected, container));
    });
  }

  enqueueRouteReconcile(pathname: string): void {
    this.queue = this.queue.then(() => this.reconcileRoute(pathname));
  }

  async reconcileRoute(pathname: string): Promise<void> {
    const selected = findRoutePlacement(this.routePlacements, pathname);
    const nextKey = selected ? placementKey(selected.manifest, selected.placement) : undefined;
    if (this.routeKey === nextKey) return;
    if (this.routeKey) await this.unmountOne(this.routeKey);
    this.routeKey = nextKey;
    if (!selected) return;

    const container = this.options.resolveRouteContainer(selected.manifest, selected.placement);
    if (container) await this.mountOne(createRuntimeMount(selected, container));
  }

  async retry(appId: string): Promise<void> {
    const failed = [...this.mounts.values()].filter((mount) => mount.manifest.id === appId && !mount.mounted);
    await Promise.all(failed.map((mount) => this.mountOne(mount)));
  }

  async stop(unsubscribe: () => void): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    unsubscribe();
    await this.queue;
    await Promise.all([...this.mounts.keys()].map((key) => this.unmountOne(key)));
  }

  private async mountOne(mount: RuntimeMount): Promise<void> {
    if (this.stopped || mount.mounted) return;
    if (mount.pending) return mount.pending;

    this.mounts.set(mount.key, mount);
    const generation = this.nextGeneration(mount);
    const isCurrent = (): boolean => this.isCurrentMount(mount, generation);
    mount.pending = this.runMount(mount, isCurrent)
      .catch((error) => this.handleMountError(mount, error, isCurrent))
      .finally(() => {
        if (mount.generation === generation) delete mount.pending;
      });
    return mount.pending;
  }

  private async runMount(mount: RuntimeMount, isCurrent: () => boolean): Promise<void> {
    this.emit(mount, "mounting");
    const readiness = createAppReadiness();
    const loading = createLoadingEmitter((state) => this.emit(mount, state), isCurrent);
    const mounting = mountApp({
      hostId: this.options.hostId,
      catalogUrl: "",
      sdk: this.options.sdk,
      manifest: mount.manifest,
      container: mount.container,
      ...(mount.placement.route?.basePath ? { basePath: mount.placement.route.basePath } : {}),
      ...(mount.placement.route?.title !== undefined ? { routeTitle: mount.placement.route.title } : {}),
      widgetLoader: this.widgetLoader,
      onReady: () => {
        if (!isCurrent()) return;
        loading.set(false);
        readiness.markReady();
      },
      onReadyRequested: () => this.requestReadiness(readiness, loading, isCurrent),
      onLoadingChange: loading.set,
      importRemote: this.options.importRemote,
      ...(this.options.trustPolicy ? { trustPolicy: this.options.trustPolicy } : {}),
      ...(this.options.importWidget ? { importWidget: this.options.importWidget } : {})
    });
    void unmountIfStale(mounting, isCurrent);

    mount.mounted = await withTimeout(mounting, this.timeoutMs, `Loading Atlas app "${mount.manifest.id}" timed out after ${this.timeoutMs}ms.`);
    if (!isCurrent()) {
      await mount.mounted.unmount();
      delete mount.mounted;
      return;
    }

    await Promise.resolve();
    if (readiness.requested) {
      await withTimeout(readiness.ready, this.timeoutMs, `Atlas app "${mount.manifest.id}" did not mark itself ready within ${this.timeoutMs}ms.`);
    }
    if (isCurrent()) this.emit(mount, "mounted");
  }

  private requestReadiness(readiness: AppReadiness, loading: LoadingEmitter, isCurrent: () => boolean): () => void {
    readiness.request();
    if (isCurrent()) loading.set(true);
    return () => {
      if (!isCurrent()) return;
      loading.set(false);
      readiness.markReady();
    };
  }

  private async handleMountError(mount: RuntimeMount, error: unknown, isCurrent: () => boolean): Promise<void> {
    if (!isCurrent()) return;
    mount.generation += 1;
    delete mount.pending;
    await mount.mounted?.unmount();
    delete mount.mounted;
    this.emit(mount, "error", toError(error));
  }

  private async unmountOne(key: string): Promise<void> {
    const mount = this.mounts.get(key);
    if (!mount) return;
    this.mounts.delete(key);
    mount.generation += 1;
    await mount.mounted?.unmount();
    this.emit(mount, "unmounted");
  }

  private nextGeneration(mount: RuntimeMount): number {
    const generation = mount.generation + 1;
    mount.generation = generation;
    return generation;
  }

  private isCurrentMount(mount: RuntimeMount, generation: number): boolean {
    return !this.stopped && mount.generation === generation && this.mounts.get(mount.key) === mount;
  }

  private emit(mount: RuntimeMount, state: AtlasHostMountState, error?: Error): void {
    this.options.onStateChange?.({ manifest: mount.manifest, placement: mount.placement, state, ...(error ? { error } : {}) });
  }
}

export async function mountApp(options: AtlasLoaderOptions & {
  manifest: AtlasManifest;
  container: HTMLElement;
  basePath?: string;
  routeTitle?: string;
  onReady?: () => void;
  onReadyRequested?: () => () => void;
  onLoadingChange?: (loading: boolean) => void;
}): Promise<AtlasMountedApp> {
  const document = options.container.ownerDocument ?? globalThis.document;
  const trustPolicy = options.trustPolicy ?? defaultManifestTrustPolicy(options.manifest);
  if (!options.importRemote || options.trustPolicy) assertManifestAssetTrust(options.manifest, trustPolicy);
  const releaseStyles = options.trustPolicy
    ? await loadManifestStyles(options.manifest, document, options.trustPolicy)
    : await loadManifestStyles(options.manifest, document);
  const boundary = createMountBoundary(options.container, options.manifest.id, options.manifest.isolation ?? "scoped");
  const releaseAssetRewrite = startRemoteAssetRewrite(options.manifest, boundary.container, document);
  const titleController = createRouteTitleController(document, options.routeTitle);
  let result: void | AtlasAppMountResult;
  try {
    const entry = await (options.importRemote ?? ((manifest) => options.trustPolicy
      ? importNativeFederationRemote(manifest, options.trustPolicy)
      : importNativeFederationRemote(manifest)))(options.manifest);
    const navigation = createScopedNavigation(options.basePath ?? findDefaultBasePath(options.manifest), options.sdk.navigation);
    const widgets = options.widgetLoader ?? createWidgetLoader([options.manifest], options.sdk, {
      ...(options.importWidget ? { importWidget: options.importWidget } : {}),
      ...(options.trustPolicy ? { trustPolicy: options.trustPolicy } : {}),
      ...(options.renderWidgetLoading ? { renderWidgetLoading: options.renderWidgetLoading } : {}),
      ...(options.renderWidgetError ? { renderWidgetError: options.renderWidgetError } : {})
    });
    result = await entry.mount({
      container: boundary.container,
      sdk: options.sdk,
      context: {
        manifest: options.manifest,
        hostId: options.hostId,
        basePath: navigation.basePath,
        navigation,
        route: createRouteContext(navigation.basePath, options.sdk.navigation, { setTabTitle: titleController.set }),
        widgets,
        loading: {
          show: () => options.onLoadingChange?.(true),
          hide: () => options.onLoadingChange?.(false),
          waitUntilReady: () => options.onReadyRequested?.() ?? options.onReady ?? (() => undefined)
        }
      }
    });
  } catch (error) {
    releaseAssetRewrite();
    boundary.remove();
    titleController.reset();
    releaseStyles();
    throw error;
  }

  return {
    manifest: options.manifest,
    async unmount() {
      try { await result?.unmount?.(); } finally { releaseAssetRewrite(); boundary.remove(); titleController.reset(); releaseStyles(); }
    }
  };
}

function createRouteTitleController(document: Document | undefined, initialTitle: string | undefined): { set(title: string): void; reset(): void } {
  if (!document) return { set() {}, reset() {} };

  const previousTitle = document.title;
  let changed = false;

  const set = (title: string): void => {
    document.title = title;
    changed = true;
  };

  if (initialTitle !== undefined) set(initialTitle);

  return {
    set,
    reset() {
      if (!changed) return;
      document.title = previousTitle;
      changed = false;
    }
  };
}

interface AppReadiness {
  readonly requested: boolean;
  readonly ready: Promise<void>;
  request(): void;
  markReady(): void;
}

interface LoadingEmitter {
  set(next: boolean): void;
}

function hostPlacements(manifests: AtlasManifest[], hostId: string): RuntimePlacement[] {
  return manifests.flatMap((manifest) => manifest.placements
    .filter((placement) => placement.hostId === hostId)
    .map((placement) => ({ manifest, placement })));
}

function createRuntimeMount(selected: RuntimePlacement, container: HTMLElement): RuntimeMount {
  return {
    key: placementKey(selected.manifest, selected.placement),
    manifest: selected.manifest,
    placement: selected.placement,
    container,
    generation: 0
  };
}

function createLoadingEmitter(emit: (state: AtlasHostMountState) => void, isCurrent: () => boolean): LoadingEmitter {
  let loading = false;
  return {
    set(next) {
      if (!isCurrent() || loading === next) return;
      loading = next;
      emit(next ? "loading" : "mounting");
    }
  };
}

async function unmountIfStale(mounting: Promise<AtlasMountedApp>, isCurrent: () => boolean): Promise<void> {
  try {
    const mounted = await mounting;
    if (!isCurrent()) await mounted.unmount();
  } catch {
    return;
  }
}

function createAppReadiness(): AppReadiness {
  let requested = false;
  let resolveReady: () => void = () => undefined;
  const ready = new Promise<void>((resolve) => { resolveReady = resolve; });
  return {
    get requested() { return requested; },
    ready,
    request() { requested = true; },
    markReady() {
      requested = true;
      resolveReady();
    }
  };
}

export function createWidgetLoader(
  manifests: AtlasManifest[],
  sdk: AtlasSdk,
  options: AtlasWidgetLoaderOptions = {}
): AtlasWidgetLoader {
  const entries = new Map<string, AtlasResolvedWidget>();
  const warnedDuplicateWidgetIds = new Set<string>();
  for (const ownerManifest of manifests) {
    for (const widget of ownerManifest.exportedWidgets ?? []) {
      const resolved = { widget, ownerManifest };
      entries.set(`${ownerManifest.id}/${widget.id}`, resolved);
      const existing = entries.get(widget.id);
      if (!existing) {
        entries.set(widget.id, resolved);
      } else if (existing.ownerManifest.id !== ownerManifest.id && !warnedDuplicateWidgetIds.has(widget.id)) {
        warnedDuplicateWidgetIds.add(widget.id);
        console.warn(`Atlas widget id "${widget.id}" is exported by multiple apps; using first match from "${existing.ownerManifest.id}".`);
      }
    }
  }

  const resolve = async (widgetId: string): Promise<AtlasResolvedWidget> => {
    const known = entries.get(widgetId);
    if (known) return known;
    if (!options.resolveWidget) throw new Error(`Atlas exported widget "${widgetId}" is not available.`);
    const resolved = await options.resolveWidget(widgetId);
    entries.set(resolved.widget.id, resolved);
    return resolved;
  };

  const getWidget = async (widgetId: string): Promise<AtlasWidgetHandle> => ({
    id: widgetId,
    name: entries.get(widgetId)?.widget.name ?? widgetId,
    mount: (container, props) => mountResolvedWidget({
      widgetId,
      container,
      props,
      sdk,
      resolve,
      initialContext: widgetRenderContext(widgetId, entries.get(widgetId)),
      options
    })
  });

  return {
    list(ownerAppId) {
      return [...entries.values()]
        .filter(({ ownerManifest }) => !ownerAppId || ownerManifest.id === ownerAppId)
        .map(({ widget }) => widget)
        .filter((widget, index, widgets) => widgets.findIndex((candidate) => candidate.id === widget.id) === index);
    },
    getWidget,
    async mount<TProps extends object>(widgetId: string, container: HTMLElement, props: TProps): Promise<AtlasMountedWidget> {
      return (await getWidget(widgetId)).mount(container, props) as Promise<AtlasMountedWidget>;
    }
  };
}

interface MountResolvedWidgetInput<TProps extends object> {
  widgetId: string;
  container: HTMLElement;
  props: TProps;
  sdk: AtlasSdk;
  resolve: (widgetId: string) => Promise<AtlasResolvedWidget>;
  initialContext: AtlasWidgetRenderContext;
  options: AtlasWidgetLoaderOptions;
}

async function mountResolvedWidget<TProps extends object>(input: MountResolvedWidgetInput<TProps>): Promise<AtlasMountedWidget> {
  const state: MountedWidgetState = { disposed: false };
  await mountWidgetAttempt(input, state);
  return {
    get widget() { return state.current?.widget; },
    async unmount() {
      state.disposed = true;
      await state.current?.unmount();
    }
  };
}

interface MountedWidgetState {
  current?: AtlasMountedWidget;
  disposed: boolean;
}

async function mountWidgetAttempt<TProps extends object>(
  input: MountResolvedWidgetInput<TProps>,
  state: MountedWidgetState
): Promise<void> {
  const card = createWidgetCard({
    parent: input.container,
    context: input.initialContext,
    options: input.options
  });
  state.current = { widget: undefined, async unmount() { card.remove(); } };
  card.showLoading();
  let resolved: AtlasResolvedWidget | undefined;
  try {
    resolved = await input.resolve(input.widgetId);
    await verifyManifestIntegrity(
      [resolved.ownerManifest],
      undefined,
      input.options.trustPolicy ?? defaultManifestTrustPolicy(resolved.ownerManifest)
    );
    const entry = await (input.options.importWidget
      ? input.options.importWidget(resolved.widget)
      : importExportedWidget(resolved.widget, resolved.ownerManifest)) as AtlasExportedWidgetEntry<TProps>;
    const releaseStyles = await loadManifestStyles(resolved.ownerManifest, card.element.ownerDocument ?? globalThis.document);
    const boundary = createMountBoundary(card.element, resolved.widget.id, resolved.ownerManifest.isolation ?? "scoped", "widget");
    const releaseAssetRewrite = startRemoteAssetRewrite(resolved.ownerManifest, boundary.container, card.element.ownerDocument ?? globalThis.document);
    card.clearStatus();
    let result: void | AtlasAppMountResult;
    try {
      result = await entry.mount({ container: boundary.container, props: input.props, sdk: input.sdk, ...resolved });
    } catch (error) {
      releaseAssetRewrite();
      boundary.remove();
      releaseStyles();
      throw error;
    }
    const mounted: AtlasMountedWidget = {
      widget: resolved.widget,
      async unmount() {
        try { await result?.unmount?.(); }
        finally { releaseAssetRewrite(); boundary.remove(); releaseStyles(); card.remove(); }
      }
    };
    if (state.disposed) await mounted.unmount();
    else state.current = mounted;
  } catch (error) {
    if (state.disposed) {
      card.remove();
      return;
    }
    card.showError(toError(error), () => {
      card.remove();
      if (!state.disposed) void mountWidgetAttempt(input, state);
    }, resolved);
  }
}

interface WidgetCardInput {
  parent: HTMLElement;
  context: AtlasWidgetRenderContext;
  options: AtlasWidgetUiOptions;
}

function createWidgetCard(input: WidgetCardInput): {
  element: HTMLElement;
  clearStatus(): void;
  showLoading(): void;
  showError(error: Error, retry: () => void, resolved?: AtlasResolvedWidget): void;
  remove(): void;
} {
  const document = input.parent.ownerDocument ?? globalThis.document;
  if (!document?.createElement) {
    return {
      element: input.parent,
      clearStatus() {},
      showLoading() {},
      showError() {},
      remove() {}
    };
  }
  const element = document.createElement("section");
  element.dataset.atlasWidgetCard = input.context.widgetId;
  input.parent.append(element);
  let disposeStatus: (() => void) | undefined;
  const clearStatus = (): void => {
    disposeStatus?.();
    disposeStatus = undefined;
    element.replaceChildren();
  };
  return {
    element,
    clearStatus,
    showLoading() {
      clearStatus();
      if (input.options.renderWidgetLoading) {
        disposeStatus = input.options.renderWidgetLoading(element, input.context) || undefined;
        return;
      }
      const status = document.createElement("div");
      status.dataset.atlasStatus = "";
      status.setAttribute("role", "status");
      status.textContent = "Loading widget...";
      element.append(status);
    },
    showError(error, retry, resolved) {
      clearStatus();
      const context = { ...widgetRenderContext(input.context.widgetId, resolved), error };
      if (input.options.renderWidgetError) {
        disposeStatus = input.options.renderWidgetError(element, context, retry) || undefined;
        return;
      }
      const status = document.createElement("div");
      status.dataset.atlasStatus = "";
      status.setAttribute("role", "alert");
      const message = document.createElement("span");
      message.textContent = `Unable to load widget. ${error.message} `;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Retry";
      button.addEventListener("click", retry, { once: true });
      status.append(message, button);
      element.append(status);
    },
    remove() {
      clearStatus();
      element.remove();
    }
  };
}

function widgetRenderContext(widgetId: string, resolved?: AtlasResolvedWidget): AtlasWidgetRenderContext {
  return {
    widgetId,
    ...(resolved ? { widget: resolved.widget, ownerManifest: resolved.ownerManifest } : {})
  };
}

function createMountBoundary(parent: HTMLElement, id: string, isolation: "scoped" | "shadow-dom", kind: "app" | "widget" = "app"): { container: HTMLElement; remove(): void } {
  const element = parent.ownerDocument?.createElement("div") ?? globalThis.document?.createElement("div");
  if (!element) return { container: parent, remove() {} };
  element.dataset[kind === "app" ? "atlasApp" : "atlasWidget"] = id;
  parent.append(element);
  if (isolation === "shadow-dom") {
    const root = element.attachShadow({ mode: "open" });
    const container = element.ownerDocument.createElement("div");
    container.dataset.atlasIsolationRoot = "";
    root.append(container);
    return { container, remove: () => element.remove() };
  }
  return { container: element, remove: () => element.remove() };
}

export async function importExportedWidget(
  widget: AtlasExportedWidgetManifest,
  ownerManifest?: AtlasManifest
): Promise<AtlasExportedWidgetEntry> {
  if (!ownerManifest) {
    const url = new URL(widget.remoteEntryUrl, globalThis.location?.href ?? "http://atlas.local");
    if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1" && url.hostname !== "[::1]") {
      throw new Error(`Atlas exported widget "${widget.ownerAppId}/${widget.id}" requires its trusted owner manifest.`);
    }
  } else {
    const baseUrl = globalThis.location?.href ?? "http://atlas.local";
    if (new URL(widget.remoteEntryUrl, baseUrl).href !== new URL(ownerManifest.remoteEntryUrl, baseUrl).href) {
      throw new Error(`Atlas exported widget "${widget.ownerAppId}/${widget.id}" does not use its owner manifest remote entry.`);
    }
    await verifyManifestIntegrity([ownerManifest], undefined, defaultManifestTrustPolicy(ownerManifest));
  }
  const remote = await import(/* @vite-ignore */ widget.remoteEntryUrl);
  const entry = remote.default ?? remote;
  if (!entry || typeof entry.mount !== "function") {
    throw new Error(`Atlas exported widget "${widget.ownerAppId}/${widget.id}" does not expose a mount function.`);
  }
  return entry as AtlasExportedWidgetEntry;
}

export async function loadAndMountHostCatalog(options: AtlasLoaderOptions & {
  resolveContainer: (manifest: AtlasManifest) => HTMLElement | undefined;
}): Promise<AtlasMountedApp[]> {
  const catalog = await loadHostCatalog(options);
  if (catalog.hostId !== options.hostId) {
    throw new Error(`Atlas catalog targets host "${catalog.hostId}", but loader targets "${options.hostId}".`);
  }
  const manifests = resolveRuntimeManifests(catalog, options.overrides);
  const trustPolicy = options.trustPolicy ?? {};
  const mounted: AtlasMountedApp[] = [];
  const widgetLoader = createWidgetLoader(manifests, options.sdk, {
    ...(options.importWidget ? { importWidget: options.importWidget } : {}),
    trustPolicy,
    ...(options.renderWidgetLoading ? { renderWidgetLoading: options.renderWidgetLoading } : {}),
    ...(options.renderWidgetError ? { renderWidgetError: options.renderWidgetError } : {})
  });

  for (const manifest of manifests) {
    const container = options.resolveContainer(manifest);
    if (!container) {
      continue;
    }

    mounted.push(await mountApp({ ...options, trustPolicy, widgetLoader, manifest, container }));
  }

  return mounted;
}

function findDefaultBasePath(manifest: AtlasManifest): string {
  return manifest.placements.find((placement) => placement.kind === "route" && placement.route)?.route?.basePath ?? `/${manifest.id}`;
}

function defaultManifestTrustPolicy(manifest: AtlasManifest): AtlasRemoteTrustPolicy {
  const baseUrl = globalThis.location?.href ?? "http://atlas.local";
  new URL(manifest.remoteEntryUrl, baseUrl);
  return {};
}

function findRoutePlacement(
  placements: Array<{ manifest: AtlasManifest; placement: AtlasPlacement }>,
  pathname: string
): { manifest: AtlasManifest; placement: AtlasPlacement } | undefined {
  return placements
    .filter(({ placement }) => routeMatches(placement.route!.basePath, pathname))
    .sort((left, right) => right.placement.route!.basePath.length - left.placement.route!.basePath.length)[0];
}

function createRoutePlacementPlan(placements: RuntimePlacement[]): { available: RuntimePlacement[]; conflicts: RuntimePlacement[] } {
  const byPath = new Map<string, RuntimePlacement[]>();
  for (const placement of placements) {
    const path = normalizeRoutePath(placement.placement.route!.basePath);
    byPath.set(path, [...(byPath.get(path) ?? []), placement]);
  }

  const available: RuntimePlacement[] = [];
  const conflicts: RuntimePlacement[] = [];
  for (const group of byPath.values()) {
    available.push(group[0]!);
    conflicts.push(...group.slice(1));
  }

  return { available, conflicts };
}

function routeMatches(basePath: string, pathname: string): boolean {
  const normalized = basePath === "/" ? "/" : basePath.replace(/\/+$/, "");
  return normalized === "/" || pathname === normalized || pathname.startsWith(`${normalized}/`);
}

function logRouteConflict(hostId: string, conflict: RuntimePlacement): void {
  const path = normalizeRoutePath(conflict.placement.route!.basePath);
  globalThis.console?.error?.(`Atlas host "${hostId}" ignored duplicate route basePath "${path}" from app "${conflict.manifest.id}". Suggested action: In atlas.config.ts routes, use a different basePath or hostId; each hostId can use a basePath only once.`);
}

function normalizeRoutePath(path: string): string {
  return path === "/" ? path : path.replace(/\/+$/, "");
}

function placementKey(manifest: AtlasManifest, placement: AtlasPlacement): string {
  return `${manifest.id}:${placement.id}`;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(message)), timeoutMs); })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
