import type { DomHostOptions } from "./dom-host-options.js";
import {
  emitRuntimeEvent,
  type AtlasHostMountEvent,
  type AtlasHostRuntime,
  type AtlasRuntimeObserver
} from "./index.js";

export function emitHostStart(options: DomHostOptions): void {
  emitRuntimeEvent(options.observe, {
    type: "host.start",
    timestamp: new Date().toISOString(),
    ...(options.runtimeConfig?.hostId ? { hostId: options.runtimeConfig.hostId } : {})
  });
}

export function emitHostReady(observer: AtlasRuntimeObserver | undefined, runtime: AtlasHostRuntime, startedAt: number): void {
  emitRuntimeEvent(observer, {
    type: "host.ready",
    timestamp: new Date().toISOString(),
    hostId: runtime.hostId,
    durationMs: Date.now() - startedAt
  });
}

export function emitHostError(options: DomHostOptions, error: Error, startedAt: number): void {
  emitRuntimeEvent(options.observe, {
    type: "host.error",
    timestamp: new Date().toISOString(),
    ...(options.runtimeConfig?.hostId ? { hostId: options.runtimeConfig.hostId } : {}),
    durationMs: Date.now() - startedAt,
    error
  });
}

export function emitMountState(observer: AtlasRuntimeObserver | undefined, hostId: string, event: AtlasHostMountEvent): void {
  emitRuntimeEvent(observer, {
    type: "app.state",
    timestamp: new Date().toISOString(),
    hostId,
    appId: event.manifest.id,
    version: event.manifest.version,
    placementId: event.placement.id,
    state: event.state,
    ...(event.error ? { error: event.error } : {})
  });
}

export function reportRetryFailure(error: unknown): void {
  console.error("Atlas host retry failed", error);
}

export function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
