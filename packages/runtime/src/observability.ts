import type { AtlasHostMountState } from "./index.js";

export type AtlasRuntimeEvent =
  | AtlasHostEvent
  | AtlasOperationEvent
  | AtlasAppEvent;

export type AtlasRuntimeObserver = (event: AtlasRuntimeEvent) => void;

interface AtlasEventBase {
  timestamp: string;
}

export interface AtlasHostEvent extends AtlasEventBase {
  type: "host.start" | "host.ready" | "host.error";
  hostId?: string;
  durationMs?: number;
  error?: Error;
}

export interface AtlasOperationEvent extends AtlasEventBase {
  type: "operation.success" | "operation.retry" | "operation.error";
  stage: string;
  attempt: number;
  maxAttempts: number;
  durationMs: number;
  resource?: string;
  appId?: string;
  version?: string;
  error?: Error;
}

export interface AtlasAppEvent extends AtlasEventBase {
  type: "app.state";
  hostId: string;
  appId: string;
  version: string;
  placementId: string;
  state: AtlasHostMountState;
  error?: Error;
}

/** Reports diagnostics without allowing monitoring providers to affect the host. */
export function emitRuntimeEvent(observer: AtlasRuntimeObserver | undefined, event: AtlasRuntimeEvent): void {
  try {
    observer?.(event);
  } catch {
    // Observability is deliberately isolated from application execution.
  }
}

export function eventTimestamp(): string {
  return new Date().toISOString();
}
