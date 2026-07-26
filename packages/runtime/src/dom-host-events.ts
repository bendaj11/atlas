import type { DomRuntimeOptions } from "./dom-host-options.js";
import { AtlasError } from "@atlas/schema";
import { createBrowserError, logBrowserError } from "./browser-error.js";
import {
  emitRuntimeEvent,
  type AtlasHostMountEvent,
  type AtlasHostRuntime,
  type AtlasRuntimeObserver
} from "./index.js";

export function emitHostStart(options: DomRuntimeOptions): void {
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

export function emitHostError(options: DomRuntimeOptions, error: Error, startedAt: number): void {
  const failure = error instanceof AtlasError ? error : toError(error);
  logBrowserError("Atlas host failed to start.", failure);
  emitRuntimeEvent(options.observe, {
    type: "host.error",
    timestamp: new Date().toISOString(),
    ...(options.runtimeConfig?.hostId ? { hostId: options.runtimeConfig.hostId } : {}),
    durationMs: Date.now() - startedAt,
    error: failure
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
  logBrowserError("Atlas host retry failed.", createBrowserError(error, {
    summary: "Atlas could not restart this page",
    suggestedActions: [
      "Check the first failed URL or configuration value in the error details.",
      "Correct the deployment or atlas.runtime.json, then reload the page."
    ],
    code: "ATLAS_HOST_RETRY_FAILED"
  }));
}

export function toError(error: unknown): AtlasError {
  return createBrowserError(error, {
    summary: "Atlas could not start this page",
    suggestedActions: [
      "Check the first failed URL or configuration value in the error details.",
      "Correct the host deployment or atlas.runtime.json, then reload the page."
    ],
    code: "ATLAS_HOST_START_FAILED"
  });
}
