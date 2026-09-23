import type {
  AtlasRuntimeEvent,
  AtlasRuntimeObserver,
} from './observability.types.js';

/** Reports diagnostics without allowing monitoring providers to affect the host. */
export function emitRuntimeEvent(
  observer: AtlasRuntimeObserver | undefined,
  event: AtlasRuntimeEvent,
): void {
  try {
    observer?.(event);
  } catch {
    return;
  }
}

export function eventTimestamp(): string {
  return new Date().toISOString();
}
