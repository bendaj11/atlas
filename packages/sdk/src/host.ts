import type { AtlasManifest } from "@atlas/contracts";
import type { AtlasNavigation } from "./navigation.js";
import type { AtlasOverlayContentMount } from "./overlay.js";

export interface AtlasUser {
  id: string;
  displayName: string;
  email?: string;
  roles?: string[];
}

export interface AtlasToastRequest {
  title: string;
  message?: string;
  state?: "info" | "warning" | "error" | "success" | "loading";
  dismissible?: boolean;
}

export interface AtlasWidgetContent {
  widget: string;
  props?: Record<string, unknown>;
}

export interface AtlasModalRequest<TResult = unknown> {
  id?: string;
  title?: string;
  /** Native framework content or an Atlas widget reference. */
  content?: unknown | AtlasWidgetContent;
  props?: Record<string, unknown>;
  onResult?: (result: TResult) => void;
}

export interface AtlasPopupBounds {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface AtlasPopupRequest {
  id?: string;
  title?: string;
  /** Native framework content or an Atlas widget reference. */
  content: unknown | AtlasWidgetContent;
  draggable?: boolean;
  resizable?: boolean;
  bounds?: AtlasPopupBounds;
}

export interface AtlasPopupRef {
  readonly id: string;
  /** Resolves when the host UI closes the popup through any path (button, escape, provider API). */
  readonly closed?: Promise<void>;
  close(): void | Promise<void>;
  update?(bounds: AtlasPopupBounds): void;
}

export type AtlasEventMap = Record<string, unknown>;

export interface AtlasEventBus<TEvents extends object = AtlasEventMap> {
  publish<TKey extends keyof TEvents & string>(type: TKey, payload: TEvents[TKey]): void;
  subscribe<TKey extends keyof TEvents & string>(type: TKey, listener: (payload: TEvents[TKey]) => void): () => void;
  once<TKey extends keyof TEvents & string>(type: TKey, listener: (payload: TEvents[TKey]) => void): () => void;
}

export type AtlasHttpClient = typeof fetch;

export interface AtlasHostData {
  readonly hostId: string;
  readonly name: string;
}

/** Stable capabilities every host exposes to every mounted MF and widget. */
export interface AtlasCoreSdk<THostData extends object = {}, TEvents extends object = AtlasEventMap> {
  readonly hostId: string;
  readonly hostData: AtlasHostData & Readonly<THostData>;
  readonly user: {
    getCurrentUser(): Promise<AtlasUser | undefined>;
  };
  readonly navigation: AtlasNavigation;
  readonly events: AtlasEventBus<TEvents>;
  readonly toast: {
    open(request: AtlasToastRequest): void;
  };
  readonly modal: {
    open<TResult = unknown>(request: AtlasModalRequest<TResult>): Promise<TResult | undefined>;
  };
  readonly popup: {
    open(request: AtlasPopupRequest): AtlasPopupRef;
  };
  readonly config: {
    get<TValue = unknown>(key: string): TValue | undefined;
  };
  readonly httpClient: AtlasHttpClient;
}

/** Core Atlas capabilities combined with host-specific, consumer-typed extensions. */
export type AtlasSdk<
  TExtensions extends object = {},
  TEvents extends object = AtlasEventMap,
  THostData extends object = {}
> = AtlasCoreSdk<THostData, TEvents> & Readonly<TExtensions>;

/** @deprecated Use AtlasSdk. */
export type AtlasHostSdk<TEvents extends object = AtlasEventMap> = AtlasSdk<{}, TEvents>;

export interface AtlasSdkOptions<
  TExtensions extends object = {},
  TEvents extends object = AtlasEventMap,
  THostData extends object = {}
> {
  hostId: string;
  hostData?: THostData & Partial<AtlasHostData>;
  navigation: AtlasNavigation;
  eventBus?: AtlasEventBus<TEvents>;
  getCurrentUser?: () => Promise<AtlasUser | undefined>;
  showToast?: (request: AtlasToastRequest) => void;
  openModal?: <TResult = unknown>(request: AtlasModalRequest<TResult>, content?: AtlasOverlayContentMount) => Promise<TResult | undefined>;
  openPopup?: (request: AtlasPopupRequest, content?: AtlasOverlayContentMount) => AtlasPopupRef;
  getConfig?: <TValue = unknown>(key: string) => TValue | undefined;
  httpClient?: AtlasHttpClient;
  extensions?: TExtensions;
}

/** @deprecated Use AtlasSdkOptions. */
export type AtlasHostSdkOptions<TEvents extends object = AtlasEventMap> = AtlasSdkOptions<{}, TEvents>;

export interface AtlasSlotRenderRequest {
  manifest: AtlasManifest;
  slot: string;
  container: HTMLElement;
}

/** Creates the single host-owned SDK instance shared with mounted MFs and widgets. */
export function createAtlasSdk<
  TExtensions extends object = {},
  TEvents extends object = AtlasEventMap,
  THostData extends object = {}
>(
  options: AtlasSdkOptions<TExtensions, TEvents, THostData>
): AtlasSdk<TExtensions, TEvents, THostData> {
  const hostData = {
    ...(options.hostData ?? {}),
    hostId: options.hostId,
    name: options.hostData?.name ?? options.hostId
  } as AtlasHostData & Readonly<THostData>;
  const core: AtlasCoreSdk<THostData, TEvents> = {
    hostId: options.hostId,
    hostData,
    user: {
      getCurrentUser: options.getCurrentUser ?? (async () => undefined)
    },
    navigation: options.navigation,
    events: options.eventBus ?? createAtlasEventBus(),
    toast: {
      open: options.showToast ?? (() => undefined)
    },
    modal: {
      open: options.openModal ?? (async () => undefined)
    },
    popup: {
      open: options.openPopup ?? (() => {
        throw new Error("This Atlas host has not configured a popup provider.");
      })
    },
    config: {
      get: options.getConfig ?? (() => undefined)
    },
    httpClient: options.httpClient ?? defaultHttpClient
  };
  assertExtensionsDoNotReplaceCore(options.extensions, core);
  return Object.assign(core, options.extensions ?? {}) as AtlasSdk<TExtensions, TEvents, THostData>;
}

/** @deprecated Use createAtlasSdk. */
export const createAtlasHostSdk = createAtlasSdk;

function assertExtensionsDoNotReplaceCore(
  extensions: object | undefined,
  core: object
): void {
  if (!extensions) return;
  const reservedName = Object.keys(extensions).find((name) => name in core);
  if (reservedName) {
    throw new Error(`Atlas SDK extension "${reservedName}" conflicts with a core SDK capability.`);
  }
}

/** Creates an in-memory host-scoped bus. Listener failures do not block other subscribers. */
export function createAtlasEventBus<TEvents extends object = AtlasEventMap>(): AtlasEventBus<TEvents> {
  const listeners = new Map<keyof TEvents & string, Set<(payload: TEvents[keyof TEvents & string]) => void>>();
  return {
    publish(type, payload) {
      for (const listener of [...(listeners.get(type) ?? [])]) {
        try { listener(payload); } catch (error) { queueMicrotask(() => { throw error; }); }
      }
    },
    subscribe(type, listener) {
      const subscribers = listeners.get(type) ?? new Set();
      subscribers.add(listener as (payload: TEvents[keyof TEvents & string]) => void);
      listeners.set(type, subscribers);
      return () => {
        subscribers.delete(listener as (payload: TEvents[keyof TEvents & string]) => void);
        if (subscribers.size === 0) listeners.delete(type);
      };
    },
    once(type, listener) {
      let unsubscribe: () => void = () => undefined;
      unsubscribe = this.subscribe(type, (payload) => { unsubscribe(); listener(payload); });
      return unsubscribe;
    }
  };
}

const defaultHttpClient: AtlasHttpClient = (input, init) => {
  if (typeof globalThis.fetch !== "function") {
    throw new Error("This Atlas host has not configured an HTTP client.");
  }
  return globalThis.fetch(input, init);
};

export function findManifestsForSlot(manifests: AtlasManifest[], hostId: string, slot: string): AtlasManifest[] {
  return manifests.filter((manifest) =>
    manifest.placements.some((placement) => placement.hostId === hostId && placement.kind === "slot" && placement.slot === slot)
  );
}
