import {
  placementTargetsHost,
  type AtlasExportedWidgetManifest,
  type AtlasManifest,
  type AtlasPlacement,
} from '@atlas/schema';
import {
  connectAtlasNavigationResolver,
  connectAtlasWidgetResolver,
  getAtlasNavigation,
  updateAtlasHostData,
} from '@atlas/sdk';
import {
  createAppNavigator,
  type AtlasNavigationTarget,
} from './app-navigator/app-navigator.js';
import type {
  AtlasGetWidgetOptions,
  AtlasHostDataOf,
  AtlasSdk,
  AtlasWidgetHandle,
  AtlasWidgetLoadingRenderer,
} from '@atlas/sdk/host';
import type {
  AtlasExportedWidgetEntry,
  AtlasExportedWidgetMountResult,
  AtlasAppEntry,
  AtlasAppMountResult,
  AtlasMountedWidget,
  AtlasWidgetLoader,
} from '@atlas/sdk/lifecycle';
import {
  createRouteContext,
  createScopedNavigation,
} from '@atlas/sdk/navigation';
import {
  assertManifestAssetTrust,
  loadHostDeployment,
  resolveRuntimeManifests,
  verifyManifestIntegrity,
  type AtlasRemoteTrustPolicy,
  type AtlasRuntimeOverride,
} from './loader/runtime-discovery.js';
import { importNativeFederationRemote } from './loader/native-federation.js';
import { startRemoteAssetRewrite } from './remote-assets/index.js';
import { loadManifestStyles } from './stylesheets.js';
import { mapWithConcurrency } from './concurrency.js';
import { createBrowserError, logBrowserError } from './browser-error.js';
import { routeMatches } from './route-matcher.js';
import { runtimeError } from './runtime-error.js';
import type {
  AtlasResolvedWidget,
  AtlasWidgetResolver,
} from './widget-registry.js';
export {
  createRegistryWidgetResolver,
  type AtlasResolvedWidget,
  type AtlasWidgetResolver,
} from './widget-registry.js';
export {
  AtlasLoadError,
  createRetryPolicy,
  runResiliently,
  type AtlasOperationContext,
  type AtlasRetryPolicy,
  type AtlasRetryPolicySource,
} from './resilience.js';
export {
  createHostUi,
  type AtlasHostUi,
  type AtlasHostUiOptions,
} from './host-ui.js';
export {
  AtlasHostAnchorRegistry,
  type AtlasHostAnchorKind,
  type AtlasHostAnchorListener,
} from './host-anchors.js';
export {
  emitRuntimeEvent,
  type AtlasHostEvent,
  type AtlasAppEvent,
  type AtlasOperationEvent,
  type AtlasRuntimeEvent,
  type AtlasRuntimeObserver,
} from './observability.js';
export { loadManifestStyles, type AtlasStyleRelease } from './stylesheets.js';
export {
  ATLAS_NAVIGATION_ITEMS_EVENT,
  createHostNavigationItems,
  publishAtlasNavigationItems,
  readAtlasNavigationItems,
  subscribeAtlasNavigationItems,
  type AtlasHostNavigationItem,
} from './host-navigation.js';
export {
  createNativeFederationImporters,
  createTrustedNativeFederationImporters,
  importNativeFederationRemote,
  type AtlasFederationAdapter,
  type AtlasNativeFederationImporters,
} from './loader/native-federation.js';
export {
  rewriteAssetUrl,
  rewriteCssAssetUrls,
  startRemoteAssetRewrite,
  type AtlasAssetRewriteRelease,
} from './remote-assets/index.js';
export {
  ATLAS_OVERRIDE_DOCUMENT_STORAGE_KEY,
  loadBrowserRuntimeOverrides,
  createRemoteTrustPolicy,
  assertManifestAssetTrust,
  assertManifestStylesTrust,
  findManifestTrustErrors,
  loadHostDeployment,
  loadPublishedManifest,
  resolveRuntimeCatalog,
  resolveRuntimeManifests,
  verifyManifestIntegrity,
  type AtlasBrowserOverrideOptions,
  type AtlasRemoteTrustPolicy,
  type AtlasRuntimeOverride,
  type AtlasRuntimeOverrideDocument,
} from './loader/runtime-discovery.js';

export type {
  AtlasExportedWidgetEntry,
  AtlasExportedWidgetMountRequest,
  AtlasAppContext,
  AtlasAppEntry,
  AtlasAppMountRequest,
  AtlasAppMountResult,
  AtlasMountedWidget,
  AtlasWidgetLoader,
} from '@atlas/sdk/lifecycle';

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
    context: AtlasWidgetRenderContext,
  ) => void | (() => void);
  renderWidgetError?: (
    container: HTMLElement,
    context: AtlasWidgetErrorRenderContext,
    retry: () => void,
  ) => void | (() => void);
}

export interface AtlasWidgetLoaderOptions extends AtlasWidgetUiOptions {
  importWidget?: (
    widget: AtlasExportedWidgetManifest,
    ownerManifest: AtlasManifest,
  ) => Promise<AtlasExportedWidgetEntry>;
  resolveWidget?: AtlasWidgetResolver;
  trustPolicy?: AtlasRemoteTrustPolicy;
}

export interface AtlasLoaderOptions extends AtlasWidgetUiOptions {
  hostId: string;
  manifestUrl?: string;
  sdk: AtlasSdk;
  fetchJson?: <T>(url: string) => Promise<T>;
  fetchBytes?: (url: string, signal?: AbortSignal) => Promise<ArrayBuffer>;
  importRemote?: (manifest: AtlasManifest) => Promise<AtlasAppEntry>;
  overrides?: AtlasRuntimeOverride[];
  importWidget?: (
    widget: AtlasExportedWidgetManifest,
    ownerManifest: AtlasManifest,
  ) => Promise<AtlasExportedWidgetEntry>;
  widgetLoader?: AtlasWidgetLoader;
  trustPolicy?: AtlasRemoteTrustPolicy;
}

export interface AtlasMountedApp {
  manifest: AtlasManifest;
  unmount(): Promise<void>;
}

export type AtlasHostMountState =
  'mounting' | 'loading' | 'mounted' | 'error' | 'unmounted';

export interface AtlasHostMountEvent {
  manifest: AtlasManifest;
  placement: AtlasPlacement;
  container: HTMLElement;
  state: AtlasHostMountState;
  error?: Error;
}

export interface AtlasHostRuntimeOptions<
  THostSdk extends object = {},
> extends AtlasWidgetUiOptions {
  hostId: string;
  manifests: AtlasManifest[];
  sdk: AtlasSdk<THostSdk>;
  importRemote: (manifest: AtlasManifest) => Promise<AtlasAppEntry>;
  importWidget?: (
    widget: AtlasExportedWidgetManifest,
  ) => Promise<AtlasExportedWidgetEntry>;
  widgetLoader?: AtlasWidgetLoader;
  resolveRouteContainer(
    manifest: AtlasManifest,
    placement: AtlasPlacement,
  ): HTMLElement | undefined;
  resolveSlotContainer(
    manifest: AtlasManifest,
    placement: AtlasPlacement,
  ): HTMLElement | undefined;
  subscribeAnchors?: (listener: () => void) => () => void;
  /** Publishes the layout selected by the currently active route. */
  setActiveLayout?(layoutId: string | undefined): void;
  onMountStateChange?: (event: AtlasHostMountEvent) => void;
  resourcesTimeoutMs?: number;
  trustPolicy?: AtlasRemoteTrustPolicy;
}

export interface AtlasHostRuntime<THostSdk extends object = {}> {
  readonly hostId: string;
  readonly manifests: AtlasManifest[];
  retry(appId: string): Promise<void>;
  updateHostData(updates: Partial<AtlasHostDataOf<THostSdk>>): void;
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
export async function startAtlasHostRuntime<THostSdk extends object = {}>(
  options: AtlasHostRuntimeOptions<THostSdk>,
): Promise<AtlasHostRuntime<THostSdk>> {
  const navigation = getAtlasNavigation(options.sdk);
  const widgetLoader =
    options.widgetLoader ??
    createWidgetLoader(options.manifests, options.sdk, {
      ...(options.importWidget ? { importWidget: options.importWidget } : {}),
      ...(options.trustPolicy ? { trustPolicy: options.trustPolicy } : {}),
      ...(options.renderWidgetLoading
        ? { renderWidgetLoading: options.renderWidgetLoading }
        : {}),
      ...(options.renderWidgetError
        ? { renderWidgetError: options.renderWidgetError }
        : {}),
    });
  const placements = hostPlacements(options.manifests, options.hostId);
  const routePlacements = placements.filter(
    ({ placement }) => placement.kind === 'route' && placement.route,
  );
  const slotPlacements = placements.filter(
    ({ placement }) => placement.kind === 'slot' && placement.slot,
  );
  const routePlan = createRoutePlacementPlan(routePlacements);
  connectAtlasNavigationResolver(
    options.sdk,
    createAppNavigator(navigation, navigationTargets(routePlan.available)),
  );
  for (const conflict of routePlan.conflicts) {
    logRouteConflict(options.hostId, conflict);
  }
  const controller = new AtlasRuntimeController(
    options,
    widgetLoader,
    routePlan.available,
    slotPlacements,
  );

  await controller.reconcileSlots();
  await controller.reconcileRoute(navigation.getCurrentLocation().pathname);
  const unsubscribe = navigation.subscribe((location) => {
    controller.enqueueRouteReconcile(location.pathname);
  });
  controller.enqueueRouteReconcile(navigation.getCurrentLocation().pathname);
  const unsubscribeAnchors =
    options.subscribeAnchors?.(() => {
      controller.enqueueRouteReconcile(
        navigation.getCurrentLocation().pathname,
      );
      controller.enqueueSlotReconcile();
    }) ?? (() => undefined);

  return {
    hostId: options.hostId,
    manifests: options.manifests,
    retry: (appId) => controller.retry(appId),
    updateHostData: (updates) => updateAtlasHostData(options.sdk, updates),
    stop: () =>
      controller.stop(() => {
        unsubscribe();
        unsubscribeAnchors();
      }),
  };
}

function navigationTargets(
  placements: readonly RuntimePlacement[],
): AtlasNavigationTarget[] {
  return [
    ...placements.map(({ manifest, placement }) => ({
      id: manifest.id,
      path: placement.route!.path,
    })),
  ];
}

class AtlasRuntimeController {
  private readonly mounts = new Map<string, RuntimeMount>();
  private readonly timeoutMs: number;
  private desiredRoute: { pathname: string; revision: number } | undefined;
  private routeKey: string | undefined;
  private routeRevision = 0;
  private routeDrainActive = false;
  private supersedeRoute: (() => void) | undefined;
  private stopped = false;
  private queue = Promise.resolve();

  constructor(
    private readonly options: AtlasHostRuntimeOptions,
    private readonly widgetLoader: AtlasWidgetLoader,
    private readonly routePlacements: RuntimePlacement[],
    private readonly slotPlacements: RuntimePlacement[],
  ) {
    this.timeoutMs = options.resourcesTimeoutMs ?? DEFAULT_RUNTIME_TIMEOUT_MS;
  }

  async reconcileSlots(): Promise<void> {
    await mapWithConcurrency(this.slotPlacements, async (selected) => {
      const key = placementKey(selected.manifest, selected.placement);
      const container = this.options.resolveSlotContainer(
        selected.manifest,
        selected.placement,
      );
      const current = this.mounts.get(key);
      if (current && current.container !== container)
        await this.unmountOne(key);
      if (container && this.mounts.get(key)?.container !== container)
        await this.mountOne(createRuntimeMount(selected, container));
    });
  }

  enqueueSlotReconcile(): void {
    this.queue = this.queue
      .catch((error) => this.reportRouteError(error))
      .then(() => this.reconcileSlots());
  }

  enqueueRouteReconcile(pathname: string): void {
    this.routeRevision += 1;
    this.desiredRoute = { pathname, revision: this.routeRevision };
    this.supersedeRoute?.();
    if (this.routeDrainActive) return;
    this.routeDrainActive = true;
    this.queue = this.queue
      .catch((error) => this.reportRouteError(error))
      .then(() => this.drainRouteRequests())
      .finally(() => {
        this.routeDrainActive = false;
        if (this.desiredRoute && !this.stopped)
          this.enqueueRouteReconcile(this.desiredRoute.pathname);
      });
  }

  async reconcileRoute(
    pathname: string,
    revision = this.routeRevision,
  ): Promise<void> {
    const selected = findRoutePlacement(this.routePlacements, pathname);
    const redirectTo = selected?.placement.route?.redirectTo;
    this.options.setActiveLayout?.(
      redirectTo
        ? undefined
        : (selected?.placement.route?.layoutId ?? 'default'),
    );
    const nextKey = selected
      ? placementKey(selected.manifest, selected.placement)
      : undefined;
    const container = selected
      ? this.options.resolveRouteContainer(
          selected.manifest,
          selected.placement,
        )
      : undefined;
    if (
      !redirectTo &&
      this.routeKey === nextKey &&
      this.mounts.get(nextKey ?? '')?.container === container
    )
      return;
    if (this.routeKey) {
      const previousKey = this.routeKey;
      this.routeKey = undefined;
      await this.unmountOne(previousKey);
    }
    if (revision !== this.routeRevision) return;
    if (redirectTo) {
      getAtlasNavigation(this.options.sdk).replace(redirectTo);
      return;
    }
    this.routeKey = nextKey;
    if (!selected || !nextKey) return;

    if (!container) return;
    const mounting = this.mountOne(createRuntimeMount(selected, container));
    let superseded = false;
    const supersededRoute = new Promise<void>((resolve) => {
      this.supersedeRoute = () => {
        superseded = true;
        resolve();
      };
    });
    await Promise.race([mounting, supersededRoute]);
    if (this.supersedeRoute) this.supersedeRoute = undefined;
    if (!superseded) return;
    void mounting.catch((error) => this.reportRouteError(error));
    if (this.routeKey === nextKey) {
      await this.unmountOne(nextKey);
      this.routeKey = undefined;
    }
  }

  async retry(appId: string): Promise<void> {
    const failed = [...this.mounts.values()].filter(
      (mount) => mount.manifest.id === appId && !mount.mounted,
    );
    await Promise.all(failed.map((mount) => this.mountOne(mount)));
  }

  async stop(unsubscribe: () => void): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    this.desiredRoute = undefined;
    this.supersedeRoute?.();
    unsubscribe();
    await this.queue;
    await Promise.all(
      [...this.mounts.keys()].map((key) => this.unmountOne(key)),
    );
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

  private async runMount(
    mount: RuntimeMount,
    isCurrent: () => boolean,
  ): Promise<void> {
    this.emit(mount, 'mounting');
    const readiness = createAppReadiness();
    const loading = createLoadingEmitter(
      (state) => this.emit(mount, state),
      isCurrent,
    );
    const mounting = mountApp({
      hostId: this.options.hostId,
      sdk: this.options.sdk,
      manifest: mount.manifest,
      container: mount.container,
      ...(mount.placement.route?.path
        ? { path: mount.placement.route.path }
        : {}),
      ...(mount.placement.route?.title !== undefined
        ? { routeTitle: mount.placement.route.title }
        : {}),
      widgetLoader: this.widgetLoader,
      onReady: () => {
        if (!isCurrent()) return;
        loading.set(false);
        readiness.markReady();
      },
      onReadyRequested: () =>
        this.requestReadiness(readiness, loading, isCurrent),
      onLoadingChange: loading.set,
      importRemote: this.options.importRemote,
      ...(this.options.trustPolicy
        ? { trustPolicy: this.options.trustPolicy }
        : {}),
      ...(this.options.importWidget
        ? { importWidget: this.options.importWidget }
        : {}),
    });
    try {
      mount.mounted = await withTimeout(
        mounting,
        this.timeoutMs,
        `Loading Atlas app "${mount.manifest.id}" timed out after ${this.timeoutMs}ms.`,
      );
    } catch (error) {
      void unmountIfStale(mounting, isCurrent);
      throw error;
    }
    if (!isCurrent()) {
      await mount.mounted.unmount();
      delete mount.mounted;
      return;
    }

    await Promise.resolve();
    if (readiness.requested) {
      await withTimeout(
        readiness.ready,
        this.timeoutMs,
        `Atlas app "${mount.manifest.id}" did not mark itself ready within ${this.timeoutMs}ms.`,
      );
    }
    if (isCurrent()) this.emit(mount, 'mounted');
  }

  private requestReadiness(
    readiness: AppReadiness,
    loading: LoadingEmitter,
    isCurrent: () => boolean,
  ): () => void {
    readiness.request();
    if (isCurrent()) loading.set(true);
    return () => {
      if (!isCurrent()) return;
      loading.set(false);
      readiness.markReady();
    };
  }

  private async handleMountError(
    mount: RuntimeMount,
    error: unknown,
    isCurrent: () => boolean,
  ): Promise<void> {
    if (!isCurrent()) return;
    mount.generation += 1;
    delete mount.pending;
    await mount.mounted?.unmount();
    delete mount.mounted;
    this.emit(
      mount,
      'error',
      createBrowserError(error, {
        summary: `Atlas could not mount app "${mount.manifest.id}"`,
        suggestedActions: [
          'Verify the app remote entry, federation metadata, and host placement configuration.',
          'Correct the app build or catalog entry, then retry loading the app.',
        ],
        code: 'ATLAS_APP_MOUNT_FAILED',
      }),
    );
  }

  private async unmountOne(key: string): Promise<void> {
    const mount = this.mounts.get(key);
    if (!mount) return;
    this.mounts.delete(key);
    mount.generation += 1;
    await mount.mounted?.unmount();
    this.emit(mount, 'unmounted');
  }

  private nextGeneration(mount: RuntimeMount): number {
    const generation = mount.generation + 1;
    mount.generation = generation;
    return generation;
  }

  private isCurrentMount(mount: RuntimeMount, generation: number): boolean {
    return (
      !this.stopped &&
      mount.generation === generation &&
      this.mounts.get(mount.key) === mount
    );
  }

  private emit(
    mount: RuntimeMount,
    state: AtlasHostMountState,
    error?: Error,
  ): void {
    this.options.onMountStateChange?.({
      manifest: mount.manifest,
      placement: mount.placement,
      container: mount.container,
      state,
      ...(error ? { error } : {}),
    });
  }

  private async drainRouteRequests(): Promise<void> {
    while (this.desiredRoute && !this.stopped) {
      const request = this.desiredRoute;
      this.desiredRoute = undefined;
      await this.reconcileRoute(request.pathname, request.revision);
    }
  }

  private reportRouteError(error: unknown): void {
    logBrowserError(
      'Atlas route reconciliation failed.',
      createBrowserError(error, {
        summary: 'Atlas could not update the active route',
        suggestedActions: [
          'Verify the route placement and app mount lifecycle named in the error details.',
          'Correct the host or app route configuration, then navigate again.',
        ],
        code: 'ATLAS_ROUTE_RECONCILIATION_FAILED',
      }),
    );
  }
}

export async function mountApp(
  options: AtlasLoaderOptions & {
    manifest: AtlasManifest;
    container: HTMLElement;
    path?: string;
    routeTitle?: string;
    onReady?: () => void;
    onReadyRequested?: () => () => void;
    onLoadingChange?: (loading: boolean) => void;
  },
): Promise<AtlasMountedApp> {
  const document = options.container.ownerDocument ?? globalThis.document;
  const trustPolicy =
    options.trustPolicy ?? defaultManifestTrustPolicy(options.manifest);
  if (!options.importRemote || options.trustPolicy)
    assertManifestAssetTrust(options.manifest, trustPolicy);
  const boundary = createMountBoundary(
    options.container,
    options.manifest.id,
    options.manifest.isolation ?? 'shadow-dom',
  );
  const releaseStyles = await loadManifestStyles(options.manifest, document, {
    ...(options.trustPolicy ? { policy: options.trustPolicy } : {}),
    ...(boundary.styleTarget ? { target: boundary.styleTarget } : {}),
  });
  const releaseAssetRewrite = startRemoteAssetRewrite(
    options.manifest,
    boundary.container,
    document,
  );
  const titleController = createRouteTitleController(
    document,
    options.routeTitle,
  );
  let result: void | AtlasAppMountResult;
  try {
    const entry = await (
      options.importRemote ??
      ((manifest) =>
        options.trustPolicy
          ? importNativeFederationRemote(manifest, options.trustPolicy)
          : importNativeFederationRemote(manifest))
    )(options.manifest);
    const hostNavigation = getAtlasNavigation(options.sdk);
    const navigation = createScopedNavigation(
      options.path ?? findDefaultPath(options.manifest),
      hostNavigation,
    );
    const widgets =
      options.widgetLoader ??
      createWidgetLoader([options.manifest], options.sdk, {
        ...(options.importWidget ? { importWidget: options.importWidget } : {}),
        ...(options.trustPolicy ? { trustPolicy: options.trustPolicy } : {}),
        ...(options.renderWidgetLoading
          ? { renderWidgetLoading: options.renderWidgetLoading }
          : {}),
        ...(options.renderWidgetError
          ? { renderWidgetError: options.renderWidgetError }
          : {}),
      });
    connectAtlasWidgetResolver(options.sdk, widgets.getWidget);
    result = await entry.mount({
      container: boundary.container,
      sdk: options.sdk,
      context: {
        manifest: options.manifest,
        hostId: options.hostId,
        path: navigation.path,
        navigation,
        route: createRouteContext(navigation.path, hostNavigation, {
          setTabTitle: titleController.set,
        }),
        loading: {
          show: () => options.onLoadingChange?.(true),
          hide: () => options.onLoadingChange?.(false),
          waitUntilReady: () =>
            options.onReadyRequested?.() ??
            options.onReady ??
            (() => undefined),
        },
      },
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
      try {
        await result?.unmount?.();
      } finally {
        releaseAssetRewrite();
        boundary.remove();
        titleController.reset();
        releaseStyles();
      }
    },
  };
}

function createRouteTitleController(
  document: Document | undefined,
  initialTitle: string | undefined,
): { set(title: string): void; reset(): void } {
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
    },
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

function hostPlacements(
  manifests: AtlasManifest[],
  hostId: string,
): RuntimePlacement[] {
  return manifests.flatMap((manifest) =>
    manifest.placements
      .filter((placement) => placementTargetsHost(placement, hostId))
      .map((placement) => ({ manifest, placement })),
  );
}

function createRuntimeMount(
  selected: RuntimePlacement,
  container: HTMLElement,
): RuntimeMount {
  return {
    key: placementKey(selected.manifest, selected.placement),
    manifest: selected.manifest,
    placement: selected.placement,
    container,
    generation: 0,
  };
}

function createLoadingEmitter(
  emit: (state: AtlasHostMountState) => void,
  isCurrent: () => boolean,
): LoadingEmitter {
  let loading = false;
  return {
    set(next) {
      if (!isCurrent() || loading === next) return;
      loading = next;
      emit(next ? 'loading' : 'mounting');
    },
  };
}

async function unmountIfStale(
  mounting: Promise<AtlasMountedApp>,
  isCurrent: () => boolean,
): Promise<void> {
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
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });
  return {
    get requested() {
      return requested;
    },
    ready,
    request() {
      requested = true;
    },
    markReady() {
      requested = true;
      resolveReady();
    },
  };
}

export function createWidgetLoader(
  manifests: AtlasManifest[],
  sdk: AtlasSdk,
  options: AtlasWidgetLoaderOptions = {},
): AtlasWidgetLoader {
  const entries = new Map<string, AtlasResolvedWidget>();
  const resolvingEntries = new Map<string, Promise<AtlasResolvedWidget>>();
  const importedEntries = new Map<string, Promise<AtlasExportedWidgetEntry>>();
  const integrityChecks = new Map<string, Promise<void>>();
  const warnedDuplicateWidgetIds = new Set<string>();
  for (const ownerManifest of manifests) {
    for (const widget of ownerManifest.exportedWidgets ?? []) {
      const resolved = { widget, ownerManifest };
      entries.set(`${ownerManifest.id}/${widget.id}`, resolved);
      const existing = entries.get(widget.id);
      if (!existing) {
        entries.set(widget.id, resolved);
      } else if (
        existing.ownerManifest.id !== ownerManifest.id &&
        !warnedDuplicateWidgetIds.has(widget.id)
      ) {
        warnedDuplicateWidgetIds.add(widget.id);
        console.warn(
          `Atlas found widget id "${widget.id}" in multiple apps and selected "${existing.ownerManifest.id}". ` +
            'Suggested action: Assign a unique UUIDv4 to each exported widget, rebuild the affected apps, and republish their manifests.',
        );
      }
    }
  }

  const resolve = async (widgetId: string): Promise<AtlasResolvedWidget> => {
    const known = entries.get(widgetId);
    if (known) return known;
    if (!options.resolveWidget) {
      throw runtimeError(
        `Atlas cannot load widget "${widgetId}" because no widget resolver is configured and the widget is not already known.`,
        {
          code: 'ATLAS_WIDGET_RESOLVER_MISSING',
          suggestedActions:
            'Configure the host SDK with createRegistryWidgetResolver, or register the widget before calling getWidget.',
        },
      );
    }
    const pending = resolvingEntries.get(widgetId);
    if (pending) return pending;
    const resolving = options
      .resolveWidget(widgetId)
      .then((resolved) => {
        entries.set(resolved.widget.id, resolved);
        return resolved;
      })
      .finally(() => resolvingEntries.delete(widgetId));
    resolvingEntries.set(widgetId, resolving);
    return resolving;
  };
  const verifyIntegrity = (resolved: AtlasResolvedWidget): Promise<void> => {
    const key = `${resolved.ownerManifest.remoteEntryUrl}\0${resolved.ownerManifest.integrity ?? ''}`;
    const existing = integrityChecks.get(key);
    if (existing) return existing;
    const checking = verifyManifestIntegrity(
      [resolved.ownerManifest],
      undefined,
      options.trustPolicy ?? defaultManifestTrustPolicy(resolved.ownerManifest),
    ).catch((error) => {
      integrityChecks.delete(key);
      throw error;
    });
    integrityChecks.set(key, checking);
    return checking;
  };
  const importEntry = (
    resolved: AtlasResolvedWidget,
  ): Promise<AtlasExportedWidgetEntry> => {
    const key = `${resolved.widget.ownerAppId}/${resolved.widget.expose}@${resolved.widget.remoteEntryUrl}`;
    const existing = importedEntries.get(key);
    if (existing) return existing;
    const importing = (
      options.importWidget
        ? options.importWidget(resolved.widget, resolved.ownerManifest)
        : importExportedWidget(resolved.widget, resolved.ownerManifest)
    ).catch((error) => {
      importedEntries.delete(key);
      throw error;
    });
    importedEntries.set(key, importing);
    return importing;
  };

  const getWidget = <TInputs extends object>(
    widgetId: string,
    widgetOptions?: AtlasGetWidgetOptions,
  ): AtlasWidgetHandle<TInputs> => ({
    id: widgetId,
    name: entries.get(widgetId)?.widget.name ?? widgetId,
    mount: (container, props) =>
      mountResolvedWidget({
        widgetId,
        container,
        props,
        sdk,
        resolve,
        verifyIntegrity,
        importEntry,
        initialContext: widgetRenderContext(widgetId, entries.get(widgetId)),
        options,
        ...(widgetOptions?.renderLoading
          ? { renderLoading: widgetOptions.renderLoading }
          : {}),
      }),
  });

  return {
    list(ownerAppId) {
      return [...entries.values()]
        .filter(
          ({ ownerManifest }) => !ownerAppId || ownerManifest.id === ownerAppId,
        )
        .map(({ widget }) => widget)
        .filter(
          (widget, index, widgets) =>
            widgets.findIndex((candidate) => candidate.id === widget.id) ===
            index,
        );
    },
    getWidget,
    async mount<TProps extends object>(
      widgetId: string,
      container: HTMLElement,
      props: TProps,
    ): Promise<AtlasMountedWidget<TProps>> {
      return getWidget<TProps>(widgetId).mount(container, props) as Promise<
        AtlasMountedWidget<TProps>
      >;
    },
  };
}

interface MountResolvedWidgetInput<TProps extends object> {
  widgetId: string;
  container: HTMLElement;
  props: TProps;
  sdk: AtlasSdk;
  resolve: (widgetId: string) => Promise<AtlasResolvedWidget>;
  verifyIntegrity: (resolved: AtlasResolvedWidget) => Promise<void>;
  importEntry: (
    resolved: AtlasResolvedWidget,
  ) => Promise<AtlasExportedWidgetEntry>;
  initialContext: AtlasWidgetRenderContext;
  options: AtlasWidgetLoaderOptions;
  renderLoading?: AtlasWidgetLoadingRenderer;
}

async function mountResolvedWidget<TProps extends object>(
  input: MountResolvedWidgetInput<TProps>,
): Promise<AtlasMountedWidget<TProps>> {
  const state: MountedWidgetState<TProps> = { disposed: false };
  await mountWidgetAttempt(input, state);
  return {
    get widget() {
      return state.current?.widget;
    },
    setInputs(inputs) {
      input.props = inputs;
      state.current?.setInputs?.(inputs);
    },
    async unmount() {
      state.disposed = true;
      await state.current?.unmount();
    },
  };
}

interface MountedWidgetState<TInputs extends object> {
  current?: AtlasMountedWidget<TInputs>;
  disposed: boolean;
}

async function mountWidgetAttempt<TProps extends object>(
  input: MountResolvedWidgetInput<TProps>,
  state: MountedWidgetState<TProps>,
): Promise<void> {
  const card = createWidgetCard({
    parent: input.container,
    context: input.initialContext,
    options: input.options,
    ...(input.renderLoading ? { renderLoading: input.renderLoading } : {}),
  });
  state.current = {
    widget: undefined,
    setInputs() {},
    async unmount() {
      card.remove();
    },
  };
  card.showLoading();
  let resolved: AtlasResolvedWidget | undefined;
  try {
    resolved = await input.resolve(input.widgetId);
    await input.verifyIntegrity(resolved);
    const entry = (await input.importEntry(
      resolved,
    )) as AtlasExportedWidgetEntry<TProps>;
    card.clearStatus();
    const boundary = createMountBoundary(
      card.element,
      resolved.widget.id,
      resolved.ownerManifest.isolation ?? 'shadow-dom',
      'widget',
    );
    const stylesheetOptions = boundary.styleTarget
      ? { target: boundary.styleTarget }
      : {};
    const releaseStyles = await loadManifestStyles(
      resolved.ownerManifest,
      card.element.ownerDocument ?? globalThis.document,
      stylesheetOptions,
    );
    const releaseAssetRewrite = startRemoteAssetRewrite(
      resolved.ownerManifest,
      boundary.container,
      card.element.ownerDocument ?? globalThis.document,
    );
    let result: void | AtlasExportedWidgetMountResult<TProps>;
    try {
      result = await entry.mount({
        container: boundary.container,
        props: input.props,
        sdk: input.sdk,
        ...resolved,
      });
    } catch (error) {
      releaseAssetRewrite();
      boundary.remove();
      releaseStyles();
      throw error;
    }
    const mounted: AtlasMountedWidget<TProps> = {
      widget: resolved.widget,
      setInputs(inputs) {
        result?.setInputs?.(inputs);
      },
      async unmount() {
        try {
          await result?.unmount?.();
        } finally {
          releaseAssetRewrite();
          boundary.remove();
          releaseStyles();
          card.remove();
        }
      },
    };
    if (state.disposed) await mounted.unmount();
    else state.current = mounted;
  } catch (error) {
    if (state.disposed) {
      card.remove();
      return;
    }
    card.showError(
      createBrowserError(error, {
        summary: `Atlas could not mount widget "${input.widgetId}"`,
        suggestedActions: [
          'Verify the widget ID, owner app manifest, remote entry, and exported mount function.',
          'Correct and republish the widget owner app, then retry loading the widget.',
        ],
        code: 'ATLAS_WIDGET_MOUNT_FAILED',
      }),
      () => {
        card.remove();
        if (!state.disposed) void mountWidgetAttempt(input, state);
      },
      resolved,
    );
  }
}

interface WidgetCardInput {
  parent: HTMLElement;
  context: AtlasWidgetRenderContext;
  options: AtlasWidgetUiOptions;
  renderLoading?: AtlasWidgetLoadingRenderer;
}

function createWidgetCard(input: WidgetCardInput): {
  element: HTMLElement;
  clearStatus(): void;
  showLoading(): void;
  showError(
    error: Error,
    retry: () => void,
    resolved?: AtlasResolvedWidget,
  ): void;
  remove(): void;
} {
  const document = input.parent.ownerDocument ?? globalThis.document;
  if (!document?.createElement) {
    return {
      element: input.parent,
      clearStatus() {},
      showLoading() {},
      showError() {},
      remove() {},
    };
  }
  const element = document.createElement('section');
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
      if (input.renderLoading) {
        disposeStatus = input.renderLoading(element) || undefined;
        return;
      }
      if (input.options.renderWidgetLoading) {
        disposeStatus =
          input.options.renderWidgetLoading(element, input.context) ||
          undefined;
        return;
      }
      const status = document.createElement('div');
      status.dataset.atlasStatus = '';
      status.setAttribute('role', 'status');
      status.textContent = 'Loading widget...';
      element.append(status);
    },
    showError(error, retry, resolved) {
      clearStatus();
      const context = {
        ...widgetRenderContext(input.context.widgetId, resolved),
        error,
      };
      if (input.options.renderWidgetError) {
        disposeStatus =
          input.options.renderWidgetError(element, context, retry) || undefined;
        return;
      }
      const status = document.createElement('div');
      status.dataset.atlasStatus = '';
      status.setAttribute('role', 'alert');
      const message = document.createElement('span');
      message.textContent = `Unable to load widget. ${error.message} `;
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Retry';
      button.addEventListener('click', retry, { once: true });
      status.append(message, button);
      element.append(status);
    },
    remove() {
      clearStatus();
      element.remove();
    },
  };
}

function widgetRenderContext(
  widgetId: string,
  resolved?: AtlasResolvedWidget,
): AtlasWidgetRenderContext {
  return {
    widgetId,
    ...(resolved
      ? { widget: resolved.widget, ownerManifest: resolved.ownerManifest }
      : {}),
  };
}

function createMountBoundary(
  parent: HTMLElement,
  id: string,
  isolation: 'shared-dom' | 'scoped' | 'shadow-dom',
  kind: 'app' | 'widget' = 'app',
): {
  container: HTMLElement;
  styleTarget: ParentNode | undefined;
  remove(): void;
} {
  const element =
    parent.ownerDocument?.createElement('div') ??
    globalThis.document?.createElement('div');
  if (!element)
    return {
      container: parent,
      styleTarget: parent.ownerDocument?.head,
      remove() {},
    };
  element.dataset[kind === 'app' ? 'atlasApp' : 'atlasWidget'] = id;
  parent.append(element);
  if (isolation === 'shadow-dom') {
    const root = element.attachShadow({ mode: 'open' });
    const container = element.ownerDocument.createElement('div');
    container.dataset.atlasIsolationRoot = '';
    root.append(container);
    return { container, styleTarget: root, remove: () => element.remove() };
  }
  return {
    container: element,
    styleTarget: element.ownerDocument.head,
    remove: () => element.remove(),
  };
}

export async function importExportedWidget(
  widget: AtlasExportedWidgetManifest,
  ownerManifest?: AtlasManifest,
): Promise<AtlasExportedWidgetEntry> {
  if (!ownerManifest) {
    const url = new URL(
      widget.remoteEntryUrl,
      globalThis.location?.href ?? 'http://atlas.local',
    );
    if (
      url.hostname !== 'localhost' &&
      url.hostname !== '127.0.0.1' &&
      url.hostname !== '[::1]'
    ) {
      throw runtimeError(
        `Atlas blocked widget "${widget.ownerAppId}/${widget.id}" because its owning app manifest is unavailable for trust verification.`,
        {
          code: 'ATLAS_WIDGET_OWNER_UNTRUSTED',
          suggestedActions: `Add app "${widget.ownerAppId}" to the host catalog or registry, then reload the page.`,
        },
      );
    }
  } else {
    const baseUrl = globalThis.location?.href ?? 'http://atlas.local';
    if (
      new URL(widget.remoteEntryUrl, baseUrl).href !==
      new URL(ownerManifest.remoteEntryUrl, baseUrl).href
    ) {
      throw runtimeError(
        `Atlas blocked widget "${widget.ownerAppId}/${widget.id}" because its remote entry does not match the owning app manifest.`,
        {
          code: 'ATLAS_WIDGET_REMOTE_MISMATCH',
          suggestedActions:
            'Correct the widget remoteEntryUrl in the published manifest so it matches the owning app remote entry.',
        },
      );
    }
    await verifyManifestIntegrity(
      [ownerManifest],
      undefined,
      defaultManifestTrustPolicy(ownerManifest),
    );
  }
  const remote = await import(/* @vite-ignore */ widget.remoteEntryUrl);
  const entry = remote.default ?? remote;
  if (!entry || typeof entry.mount !== 'function') {
    throw runtimeError(
      `Atlas loaded widget "${widget.ownerAppId}/${widget.id}", but the module does not export the required mount function.`,
      {
        code: 'ATLAS_WIDGET_MOUNT_MISSING',
        suggestedActions:
          'Rebuild the owning app with the Atlas widget entry template, verify its mount export, and republish it.',
      },
    );
  }
  return entry as AtlasExportedWidgetEntry;
}

export async function loadAndMountHostCatalog(
  options: AtlasLoaderOptions & {
    resolveContainer: (manifest: AtlasManifest) => HTMLElement | undefined;
  },
): Promise<AtlasMountedApp[]> {
  const catalog = await loadHostDeployment({
    manifestUrl: requiredManifestUrl(options.manifestUrl),
    ...(options.fetchBytes ? { fetchBytes: options.fetchBytes } : {}),
  });
  if (catalog.hostId !== options.hostId) {
    throw runtimeError(
      `Atlas loaded a catalog for host "${catalog.hostId}", but this page is configured as host "${options.hostId}".`,
      {
        code: 'ATLAS_HOST_CATALOG_MISMATCH',
        suggestedActions: `Point manifestUrl to the deployment for host "${options.hostId}", or correct the configured hostId.`,
      },
    );
  }
  const manifests = resolveRuntimeManifests(catalog, options.overrides);
  const trustPolicy = options.trustPolicy ?? {};
  const mounted: AtlasMountedApp[] = [];
  const widgetLoader = createWidgetLoader(manifests, options.sdk, {
    ...(options.importWidget ? { importWidget: options.importWidget } : {}),
    trustPolicy,
    ...(options.renderWidgetLoading
      ? { renderWidgetLoading: options.renderWidgetLoading }
      : {}),
    ...(options.renderWidgetError
      ? { renderWidgetError: options.renderWidgetError }
      : {}),
  });

  for (const manifest of manifests) {
    const container = options.resolveContainer(manifest);
    if (!container) {
      continue;
    }

    mounted.push(
      await mountApp({
        ...options,
        trustPolicy,
        widgetLoader,
        manifest,
        container,
      }),
    );
  }

  return mounted;
}

function requiredManifestUrl(value: string | undefined): string {
  if (!value) {
    throw runtimeError('Atlas loader requires manifestUrl.', {
      code: 'ATLAS_MANIFEST_URL_MISSING',
      suggestedActions:
        'Pass the active environments/<environment>/hosts/<id>/manifest.json URL.',
    });
  }
  return value;
}

function findDefaultPath(manifest: AtlasManifest): string {
  return (
    manifest.placements.find(
      (placement) => placement.kind === 'route' && placement.route,
    )?.route?.path ?? `/${manifest.id}`
  );
}

function defaultManifestTrustPolicy(
  manifest: AtlasManifest,
): AtlasRemoteTrustPolicy {
  const baseUrl = globalThis.location?.href ?? 'http://atlas.local';
  new URL(manifest.remoteEntryUrl, baseUrl);
  return {};
}

function findRoutePlacement(
  placements: Array<{ manifest: AtlasManifest; placement: AtlasPlacement }>,
  pathname: string,
): { manifest: AtlasManifest; placement: AtlasPlacement } | undefined {
  return placements
    .filter(({ placement }) => routeMatches(placement.route!, pathname))
    .sort(
      (left, right) =>
        right.placement.route!.path.length - left.placement.route!.path.length,
    )[0];
}

function createRoutePlacementPlan(placements: RuntimePlacement[]): {
  available: RuntimePlacement[];
  conflicts: RuntimePlacement[];
} {
  const byPath = new Map<string, RuntimePlacement[]>();
  for (const placement of placements) {
    const path = normalizeRoutePath(placement.placement.route!.path);
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

function logRouteConflict(hostId: string, conflict: RuntimePlacement): void {
  const path = normalizeRoutePath(conflict.placement.route!.path);
  logBrowserError(
    'Atlas ignored a conflicting route.',
    createBrowserError(
      new Error(
        `Host "${hostId}" already has an app assigned to route "${path}", so app "${conflict.manifest.id}" was not mounted there.`,
      ),
      {
        summary: 'Atlas found two apps assigned to the same host route',
        suggestedActions: [
          `Give route "${path}" to only one app for host "${hostId}".`,
          'Update atlas.config.ts in the conflicting app, rebuild it, and republish its manifest.',
        ],
        code: 'ATLAS_DUPLICATE_ROUTE',
      },
    ),
  );
}

function normalizeRoutePath(path: string): string {
  return path === '/' ? path : path.replace(/\/+$/, '');
}

function placementKey(
  manifest: AtlasManifest,
  placement: AtlasPlacement,
): string {
  return `${manifest.id}:${placement.id}`;
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
