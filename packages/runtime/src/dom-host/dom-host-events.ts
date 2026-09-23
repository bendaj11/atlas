import type { AtlasError } from '@atlas/schema';
import type {
  AtlasHostMountEvent,
  AtlasHostRuntime,
} from '../host-runtime/host-runtime.types.js';
import {
  emitRuntimeEvent,
  eventTimestamp,
} from '../observability/observability.js';
import type { AtlasRuntimeObserver } from '../observability/observability.types.js';
import { logBrowserError } from '../shared/errors.js';
import type { DomRuntimeOptions } from './dom-host.types.js';

export function emitHostStart(options: DomRuntimeOptions): void {
  emitRuntimeEvent(options.observe, {
    type: 'host.start',
    timestamp: eventTimestamp(),
    ...(options.runtimeConfig?.hostId
      ? { hostId: options.runtimeConfig.hostId }
      : {}),
  });
}

export function emitHostReady(
  observer: AtlasRuntimeObserver | undefined,
  runtime: AtlasHostRuntime,
  startedAt: number,
): void {
  emitRuntimeEvent(observer, {
    type: 'host.ready',
    timestamp: eventTimestamp(),
    hostId: runtime.hostId,
    durationMs: Date.now() - startedAt,
  });
}

export function emitHostError(
  options: DomRuntimeOptions,
  error: AtlasError,
  startedAt: number,
): void {
  logBrowserError('Atlas host failed to start.', error);

  emitRuntimeEvent(options.observe, {
    type: 'host.error',
    timestamp: eventTimestamp(),
    ...(options.runtimeConfig?.hostId
      ? { hostId: options.runtimeConfig.hostId }
      : {}),
    durationMs: Date.now() - startedAt,
    error,
  });
}

export function emitMountState(
  observer: AtlasRuntimeObserver | undefined,
  hostId: string,
  event: AtlasHostMountEvent,
): void {
  emitRuntimeEvent(observer, {
    type: 'app.state',
    timestamp: eventTimestamp(),
    hostId,
    appId: event.manifest.id,
    version: event.manifest.version,
    placementId: event.placement.id,
    state: event.state,
    ...(event.error ? { error: event.error } : {}),
  });
}
