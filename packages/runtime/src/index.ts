import type { AtlasExportedComponentManifest, AtlasManifest, AtlasPlacement } from "@atlas/schema";
import type { AtlasSdk } from "@atlas/sdk/host";
import type {
  AtlasExportedComponentEntry,
  AtlasMfEntry,
  AtlasMfMountResult,
  AtlasMountedWidget,
  AtlasWidgetLoader
} from "@atlas/sdk/lifecycle";
import { createRouteContext, createScopedNavigation } from "@atlas/sdk/navigation";
import { assertManifestAssetTrust, loadHostCatalog, resolveRuntimeManifests, verifyManifestIntegrity, type AtlasRemoteTrustPolicy, type AtlasRuntimeOverride } from "./loader/runtime-discovery.js";
import { importNativeFederationRemote } from "./loader/native-federation.js";
import { loadManifestStyles } from "./stylesheets.js";
import { mapWithConcurrency } from "./concurrency.js";
export { AtlasLoadError, createRetryPolicy, runResiliently, type AtlasOperationContext, type AtlasRetryPolicy, type AtlasRetryPolicySource } from "./resilience.js";
export { createHostUi, type AtlasHostUi, type AtlasHostUiOptions } from "./host-ui.js";
export {
  emitRuntimeEvent,
  type AtlasHostEvent,
  type AtlasMicrofrontendEvent,
  type AtlasOperationEvent,
  type AtlasRuntimeEvent,
  type AtlasRuntimeObserver
} from "./observability.js";
export { loadManifestStyles, type AtlasStyleRelease } from "./stylesheets.js";
export {
  createNativeFederationImporters,
  createTrustedNativeFederationImporters,
  importNativeFederationRemote,
  type AtlasFederationAdapter,
  type AtlasNativeFederationImporters
} from "./loader/native-federation.js";
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
  AtlasExportedComponentEntry,
  AtlasExportedComponentMountRequest,
  AtlasMfContext,
  AtlasMfEntry,
  AtlasMfMountRequest,
  AtlasMfMountResult,
  AtlasMountedWidget,
  AtlasWidgetLoader
} from "@atlas/sdk/lifecycle";

export interface AtlasLoaderOptions {
  hostId: string;
  catalogUrl: string;
  sdk: AtlasSdk;
  fetchJson?: <T>(url: string) => Promise<T>;
  importRemote?: (manifest: AtlasManifest) => Promise<AtlasMfEntry>;
  overrides?: AtlasRuntimeOverride[];
  importComponent?: (component: AtlasExportedComponentManifest) => Promise<AtlasExportedComponentEntry>;
  widgetLoader?: AtlasWidgetLoader;
  trustPolicy?: AtlasRemoteTrustPolicy;
}

export interface AtlasMountedMf {
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

export interface AtlasHostRuntimeOptions {
  hostId: string;
  manifests: AtlasManifest[];
  sdk: AtlasSdk;
  importRemote: (manifest: AtlasManifest) => Promise<AtlasMfEntry>;
  importComponent?: (component: AtlasExportedComponentManifest) => Promise<AtlasExportedComponentEntry>;
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
  retry(mfId: string): Promise<void>;
  stop(): Promise<void>;
}

interface RuntimeMount {
  key: string;
  manifest: AtlasManifest;
  placement: AtlasPlacement;
  container: HTMLElement;
  mounted?: AtlasMountedMf;
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
  const widgetLoader = options.widgetLoader ?? createWidgetLoader(options.manifests, options.sdk, options.importComponent);
  const placements = hostPlacements(options.manifests, options.hostId);
  const routePlacements = placements.filter(({ placement }) => placement.kind === "route" && placement.route);
  const slotPlacements = placements.filter(({ placement }) => placement.kind === "slot" && placement.slot);
  assertUniqueRoutePlacements(routePlacements);
  const controller = new AtlasRuntimeController(options, widgetLoader, routePlacements);

  await controller.mountSlots(slotPlacements);
  await controller.reconcileRoute(options.sdk.navigation.getCurrentLocation().pathname);
  const unsubscribe = options.sdk.navigation.subscribe((location) => {
    controller.enqueueRouteReconcile(location.pathname);
  });

  return {
    hostId: options.hostId,
    manifests: options.manifests,
    retry: (mfId) => controller.retry(mfId),
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

  async retry(mfId: string): Promise<void> {
    const failed = [...this.mounts.values()].filter((mount) => mount.manifest.id === mfId && !mount.mounted);
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
    const mounting = mountMicrofrontend({
      hostId: this.options.hostId,
      catalogUrl: "",
      sdk: this.options.sdk,
      manifest: mount.manifest,
      container: mount.container,
      ...(mount.placement.route?.basePath ? { basePath: mount.placement.route.basePath } : {}),
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
      ...(this.options.importComponent ? { importComponent: this.options.importComponent } : {})
    });
    void unmountIfStale(mounting, isCurrent);

    mount.mounted = await withTimeout(mounting, this.timeoutMs, `Loading Atlas MF "${mount.manifest.id}" timed out after ${this.timeoutMs}ms.`);
    if (!isCurrent()) {
      await mount.mounted.unmount();
      delete mount.mounted;
      return;
    }

    await Promise.resolve();
    if (readiness.requested) {
      await withTimeout(readiness.ready, this.timeoutMs, `Atlas MF "${mount.manifest.id}" did not mark itself ready within ${this.timeoutMs}ms.`);
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

export async function mountMicrofrontend(options: AtlasLoaderOptions & {
  manifest: AtlasManifest;
  container: HTMLElement;
  basePath?: string;
  onReady?: () => void;
  onReadyRequested?: () => () => void;
  onLoadingChange?: (loading: boolean) => void;
}): Promise<AtlasMountedMf> {
  const document = options.container.ownerDocument ?? globalThis.document;
  const trustPolicy = options.trustPolicy ?? defaultManifestTrustPolicy(options.manifest);
  if (!options.importRemote || options.trustPolicy) assertManifestAssetTrust(options.manifest, trustPolicy);
  const releaseStyles = options.trustPolicy
    ? await loadManifestStyles(options.manifest, document, options.trustPolicy)
    : await loadManifestStyles(options.manifest, document);
  const boundary = createMountBoundary(options.container, options.manifest.id, options.manifest.isolation ?? "scoped");
  let result: void | AtlasMfMountResult;
  try {
    const entry = await (options.importRemote ?? ((manifest) => options.trustPolicy
      ? importNativeFederationRemote(manifest, options.trustPolicy)
      : importNativeFederationRemote(manifest)))(options.manifest);
    const navigation = createScopedNavigation(options.basePath ?? findDefaultBasePath(options.manifest), options.sdk.navigation);
    const widgets = options.widgetLoader ?? createWidgetLoader([options.manifest], options.sdk, options.importComponent);
    result = await entry.mount({
      container: boundary.container,
      sdk: options.sdk,
      context: {
        manifest: options.manifest,
        hostId: options.hostId,
        basePath: navigation.basePath,
        navigation,
        route: createRouteContext(navigation.basePath, options.sdk.navigation),
        widgets,
        loading: {
          show: () => options.onLoadingChange?.(true),
          hide: () => options.onLoadingChange?.(false),
          waitUntilReady: () => options.onReadyRequested?.() ?? options.onReady ?? (() => undefined)
        }
      }
    });
  } catch (error) {
    boundary.remove();
    releaseStyles();
    throw error;
  }

  return {
    manifest: options.manifest,
    async unmount() {
      try { await result?.unmount?.(); } finally { boundary.remove(); releaseStyles(); }
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

async function unmountIfStale(mounting: Promise<AtlasMountedMf>, isCurrent: () => boolean): Promise<void> {
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
  importComponent?: (component: AtlasExportedComponentManifest) => Promise<AtlasExportedComponentEntry>
): AtlasWidgetLoader {
  const entries = new Map<string, { component: AtlasExportedComponentManifest; ownerManifest: AtlasManifest }>();
  for (const ownerManifest of manifests) {
    for (const component of ownerManifest.exportedComponents ?? []) {
      entries.set(`${ownerManifest.id}/${component.id}`, { component, ownerManifest });
    }
  }

  return {
    list(ownerMfId) {
      return [...entries.values()]
        .filter(({ ownerManifest }) => !ownerMfId || ownerManifest.id === ownerMfId)
        .map(({ component }) => component);
    },
    async mount<TProps extends object>(componentRef: string, container: HTMLElement, props: TProps): Promise<AtlasMountedWidget> {
      const resolved = entries.get(componentRef);
      if (!resolved) throw new Error(`Atlas exported component "${componentRef}" is not available in the selected catalog.`);
      const entry = await (importComponent
        ? importComponent(resolved.component)
        : importExportedComponent(resolved.component, resolved.ownerManifest)) as AtlasExportedComponentEntry<TProps>;
      const releaseStyles = await loadManifestStyles(resolved.ownerManifest, container.ownerDocument ?? globalThis.document);
      const boundary = createMountBoundary(container, componentRef, resolved.ownerManifest.isolation ?? "scoped", "widget");
      let result: void | AtlasMfMountResult;
      try {
        result = await entry.mount({ container: boundary.container, props, sdk, ...resolved });
      } catch (error) {
        boundary.remove();
        releaseStyles();
        throw error;
      }
      return {
        component: resolved.component,
        async unmount() { try { await result?.unmount?.(); } finally { boundary.remove(); releaseStyles(); } }
      };
    }
  };
}

function createMountBoundary(parent: HTMLElement, id: string, isolation: "scoped" | "shadow-dom", kind: "mf" | "widget" = "mf"): { container: HTMLElement; remove(): void } {
  const element = parent.ownerDocument?.createElement("div") ?? globalThis.document?.createElement("div");
  if (!element) return { container: parent, remove() {} };
  element.dataset[kind === "mf" ? "atlasMf" : "atlasWidget"] = id;
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

export async function importExportedComponent(
  component: AtlasExportedComponentManifest,
  ownerManifest?: AtlasManifest
): Promise<AtlasExportedComponentEntry> {
  if (!ownerManifest) {
    const url = new URL(component.remoteEntryUrl, globalThis.location?.href ?? "http://atlas.local");
    if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1" && url.hostname !== "[::1]") {
      throw new Error(`Atlas exported component "${component.ownerMfId}/${component.id}" requires its trusted owner manifest.`);
    }
  } else {
    const baseUrl = globalThis.location?.href ?? "http://atlas.local";
    if (new URL(component.remoteEntryUrl, baseUrl).href !== new URL(ownerManifest.remoteEntryUrl, baseUrl).href) {
      throw new Error(`Atlas exported component "${component.ownerMfId}/${component.id}" does not use its owner manifest remote entry.`);
    }
    await verifyManifestIntegrity([ownerManifest], undefined, defaultManifestTrustPolicy(ownerManifest));
  }
  const remote = await import(/* @vite-ignore */ component.remoteEntryUrl);
  const entry = remote.default ?? remote;
  if (!entry || typeof entry.mount !== "function") {
    throw new Error(`Atlas exported component "${component.ownerMfId}/${component.id}" does not expose a mount function.`);
  }
  return entry as AtlasExportedComponentEntry;
}

export async function loadAndMountHostCatalog(options: AtlasLoaderOptions & {
  resolveContainer: (manifest: AtlasManifest) => HTMLElement | undefined;
}): Promise<AtlasMountedMf[]> {
  const catalog = await loadHostCatalog(options);
  if (catalog.hostId !== options.hostId) {
    throw new Error(`Atlas catalog targets host "${catalog.hostId}", but loader targets "${options.hostId}".`);
  }
  const manifests = resolveRuntimeManifests(catalog, options.overrides);
  const trustPolicy = options.trustPolicy ?? {};
  const mounted: AtlasMountedMf[] = [];
  const widgetLoader = createWidgetLoader(manifests, options.sdk, options.importComponent);

  for (const manifest of manifests) {
    const container = options.resolveContainer(manifest);
    if (!container) {
      continue;
    }

    mounted.push(await mountMicrofrontend({ ...options, trustPolicy, widgetLoader, manifest, container }));
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

function routeMatches(basePath: string, pathname: string): boolean {
  const normalized = basePath === "/" ? "/" : basePath.replace(/\/+$/, "");
  return normalized === "/" || pathname === normalized || pathname.startsWith(`${normalized}/`);
}

function assertUniqueRoutePlacements(placements: Array<{ manifest: AtlasManifest; placement: AtlasPlacement }>): void {
  const paths = new Map<string, string>();
  for (const { manifest, placement } of placements) {
    const path = placement.route!.basePath === "/" ? "/" : placement.route!.basePath.replace(/\/+$/, "");
    const existing = paths.get(path);
    if (existing) throw new Error(`Atlas runtime has ambiguous exact route "${path}" in placements "${existing}" and "${manifest.id}:${placement.id}".`);
    paths.set(path, `${manifest.id}:${placement.id}`);
  }
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
