import { getAtlasNavigation } from '@atlas/sdk';
import type { AtlasWidgetLoader } from '@atlas/sdk/lifecycle';
import {
  AtlasAppMountError,
  AtlasAppMountTimeoutError,
} from '../mount-app/mount-app.errors.js';
import { mountApp } from '../mount-app/mount-app.js';
import { mapWithConcurrency } from '../shared/concurrency.js';
import { logBrowserError } from '../shared/errors.js';
import { AtlasRouteReconciliationError } from './host-runtime.errors.js';
import type {
  AppReadiness,
  AtlasHostMountState,
  AtlasHostRuntimeOptions,
  AtlasMountedApp,
  HostPlacement,
  IsMountCurrent,
  LoadingStateEmitter,
  PlacementMountRecord,
  RouteReconcileRequest,
  RuntimeControllerInput,
} from './host-runtime.types.js';
import {
  createPlacementKey,
  createPlacementMountRecord,
  findRoutePlacementForPathname,
} from './route-plan.js';

const DEFAULT_RUNTIME_TIMEOUT_MS = 15_000;

export class AtlasRuntimeController {
  private readonly options: AtlasHostRuntimeOptions;
  private readonly widgetLoader: AtlasWidgetLoader;
  private readonly routePlacements: HostPlacement[];
  private readonly slotPlacements: HostPlacement[];
  private readonly mountsByKey = new Map<string, PlacementMountRecord>();
  private readonly timeoutMs: number;
  private desiredRoute: RouteReconcileRequest | undefined;
  private activeRouteKey: string | undefined;
  private activeLayoutId: string | undefined;
  private layoutPublished = false;
  private routeRevision = 0;
  private routeDrainActive = false;
  private supersedePendingRoute: (() => void) | undefined;
  private stopped = false;
  private queue = Promise.resolve();

  constructor(input: RuntimeControllerInput) {
    this.options = input.options;
    this.widgetLoader = input.widgetLoader;
    this.routePlacements = input.routePlacements;
    this.slotPlacements = input.slotPlacements;
    this.timeoutMs =
      input.options.resourcesTimeoutMs ?? DEFAULT_RUNTIME_TIMEOUT_MS;
  }

  async reconcileSlots(): Promise<void> {
    await mapWithConcurrency(this.slotPlacements, async (selected) => {
      const key = createPlacementKey(selected.manifest, selected.placement);
      const container = this.options.resolveSlotContainer(
        selected.manifest,
        selected.placement,
      );
      const current = this.mountsByKey.get(key);

      if (current && current.container !== container)
        await this.unmountPlacement(key);

      if (container && this.mountsByKey.get(key)?.container !== container)
        await this.mountPlacement(
          createPlacementMountRecord(selected, container),
        );
    });
  }

  enqueueSlotReconcile(): void {
    this.enqueue(() => this.reconcileSlots());
  }

  enqueueRouteReconcile(pathname: string): void {
    this.routeRevision += 1;
    this.desiredRoute = { pathname, revision: this.routeRevision };
    this.supersedePendingRoute?.();

    if (this.routeDrainActive) return;

    this.routeDrainActive = true;
    this.enqueue(() =>
      this.drainRouteRequests().finally(() => {
        this.routeDrainActive = false;

        if (this.desiredRoute && !this.stopped)
          this.enqueueRouteReconcile(this.desiredRoute.pathname);
      }),
    );
  }

  async reconcileRoute(
    pathname: string,
    revision = this.routeRevision,
  ): Promise<void> {
    const selected = findRoutePlacementForPathname(
      this.routePlacements,
      pathname,
    );
    const redirectTo = selected?.placement.route?.redirectTo;

    this.publishActiveLayout(
      redirectTo
        ? undefined
        : (selected?.placement.route?.layoutId ?? 'default'),
    );

    const nextKey = selected
      ? createPlacementKey(selected.manifest, selected.placement)
      : undefined;
    const container = selected
      ? this.options.resolveRouteContainer(
          selected.manifest,
          selected.placement,
        )
      : undefined;

    if (
      !redirectTo &&
      this.activeRouteKey === nextKey &&
      this.mountsByKey.get(nextKey ?? '')?.container === container
    )
      return;

    if (this.activeRouteKey) {
      const previousKey = this.activeRouteKey;
      this.activeRouteKey = undefined;

      await this.unmountPlacement(previousKey);
    }

    if (revision !== this.routeRevision) return;

    if (redirectTo) {
      getAtlasNavigation(this.options.sdk).replace(redirectTo);

      return;
    }

    this.activeRouteKey = nextKey;

    if (!selected || !nextKey || !container) return;

    await this.mountRoutePlacement(
      nextKey,
      createPlacementMountRecord(selected, container),
    );
  }

  async retry(appId: string): Promise<void> {
    const failed = [...this.mountsByKey.values()].filter(
      (mount) => mount.manifest.id === appId && !mount.mounted,
    );

    await Promise.all(failed.map((mount) => this.mountPlacement(mount)));
  }

  async stop(unsubscribe: () => void): Promise<void> {
    if (this.stopped) return;

    this.stopped = true;
    this.desiredRoute = undefined;
    this.supersedePendingRoute?.();

    unsubscribe();

    await this.queue;
    await Promise.all(
      [...this.mountsByKey.keys()].map((key) => this.unmountPlacement(key)),
    );
  }

  private publishActiveLayout(layoutId: string | undefined): void {
    if (this.layoutPublished && this.activeLayoutId === layoutId) return;

    this.layoutPublished = true;
    this.activeLayoutId = layoutId;
    this.options.setActiveLayout?.(layoutId);
  }

  private enqueue(step: () => Promise<void>): void {
    this.queue = this.queue.then(() =>
      step().catch((error) => this.reportRouteError(error)),
    );
  }

  private async mountRoutePlacement(
    key: string,
    mount: PlacementMountRecord,
  ): Promise<void> {
    const mounting = this.mountPlacement(mount);
    let superseded = false;
    const supersededRoute = new Promise<void>((resolve) => {
      this.supersedePendingRoute = () => {
        superseded = true;

        resolve();
      };
    });

    await Promise.race([mounting, supersededRoute]);

    this.supersedePendingRoute = undefined;

    if (!superseded) return;

    void mounting.catch((error) => this.reportRouteError(error));

    if (this.activeRouteKey === key) {
      await this.unmountPlacement(key);

      this.activeRouteKey = undefined;
    }
  }

  private async mountPlacement(mount: PlacementMountRecord): Promise<void> {
    if (this.stopped || mount.mounted) return;

    if (mount.pending) return mount.pending;

    this.mountsByKey.set(mount.key, mount);

    const generation = this.advanceGeneration(mount);
    const isCurrent = () => this.isMountCurrent(mount, generation);

    mount.pending = this.runMount(mount, isCurrent)
      .catch((error) => this.handleMountError(mount, error, isCurrent))
      .finally(() => {
        if (mount.generation === generation) delete mount.pending;
      });

    return mount.pending;
  }

  private async runMount(
    mount: PlacementMountRecord,
    isCurrent: IsMountCurrent,
  ): Promise<void> {
    this.emitMountState(mount, 'mounting');

    const readiness = createAppReadiness();
    const loading = createLoadingStateEmitter(
      (state) => this.emitMountState(mount, state),
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
      mount.mounted = await awaitWithTimeout({
        promise: mounting,
        timeoutMs: this.timeoutMs,
        message: `Loading Atlas app "${mount.manifest.id}" timed out after ${this.timeoutMs}ms.`,
      });
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
      await awaitWithTimeout({
        promise: readiness.ready,
        timeoutMs: this.timeoutMs,
        message: `Atlas app "${mount.manifest.id}" did not mark itself ready within ${this.timeoutMs}ms.`,
      });
    }

    if (isCurrent()) this.emitMountState(mount, 'mounted');
  }

  private requestReadiness(
    readiness: AppReadiness,
    loading: LoadingStateEmitter,
    isCurrent: IsMountCurrent,
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
    mount: PlacementMountRecord,
    error: unknown,
    isCurrent: IsMountCurrent,
  ): Promise<void> {
    if (!isCurrent()) return;

    mount.generation += 1;
    delete mount.pending;

    await mount.mounted?.unmount();

    delete mount.mounted;
    this.emitMountState(
      mount,
      'error',
      new AtlasAppMountError(mount.manifest.id, error),
    );
  }

  private async unmountPlacement(key: string): Promise<void> {
    const mount = this.mountsByKey.get(key);

    if (!mount) return;

    this.mountsByKey.delete(key);

    mount.generation += 1;

    await mount.mounted?.unmount();

    this.emitMountState(mount, 'unmounted');
  }

  private advanceGeneration(mount: PlacementMountRecord): number {
    mount.generation += 1;

    return mount.generation;
  }

  private isMountCurrent(
    mount: PlacementMountRecord,
    generation: number,
  ): boolean {
    return (
      !this.stopped &&
      mount.generation === generation &&
      this.mountsByKey.get(mount.key) === mount
    );
  }

  private emitMountState(
    mount: PlacementMountRecord,
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
      new AtlasRouteReconciliationError(error),
    );
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

function createLoadingStateEmitter(
  emit: (state: AtlasHostMountState) => void,
  isCurrent: IsMountCurrent,
): LoadingStateEmitter {
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
  isCurrent: IsMountCurrent,
): Promise<void> {
  try {
    const mounted = await mounting;

    if (!isCurrent()) await mounted.unmount();
  } catch {
    return;
  }
}

async function awaitWithTimeout<T>(input: {
  promise: Promise<T>;
  timeoutMs: number;
  message: string;
}): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      input.promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new AtlasAppMountTimeoutError(input.message)),
          input.timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
