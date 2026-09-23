import type { AtlasHostMountState } from '../host-runtime/host-runtime.types.js';

export type AtlasRuntimeEvent =
  AtlasHostEvent | AtlasOperationEvent | AtlasAppEvent;

export type AtlasRuntimeObserver = (event: AtlasRuntimeEvent) => void;

interface AtlasEventBase {
  timestamp: string;
}

export type AtlasHostEventType = 'host.start' | 'host.ready' | 'host.error';

export interface AtlasHostEvent extends AtlasEventBase {
  type: AtlasHostEventType;
  hostId?: string;
  durationMs?: number;
  error?: Error;
}

export type AtlasOperationEventType =
  'operation.success' | 'operation.retry' | 'operation.error';

export interface AtlasOperationEvent extends AtlasEventBase {
  type: AtlasOperationEventType;
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
  type: 'app.state';
  hostId: string;
  appId: string;
  version: string;
  placementId: string;
  state: AtlasHostMountState;
  error?: Error;
}
