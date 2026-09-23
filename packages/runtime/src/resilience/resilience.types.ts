import type { AtlasRuntimeObserver } from '../observability/observability.types.js';

export interface AtlasRetryPolicy {
  timeoutMs?: number;
  retryCount?: number;
  observer?: AtlasRuntimeObserver;
}

export interface AtlasRetryPolicySource {
  resourcesTimeoutMs?: number;
  resourcesRetryCount?: number;
}

export interface AtlasOperationContext {
  stage: string;
  resource?: string;
  appId?: string;
  version?: string;
}

export type ResilientOperationRunner<T> = (signal: AbortSignal) => Promise<T>;

export interface ResilientOperation<T> {
  operation: ResilientOperationRunner<T>;
  context: AtlasOperationContext;
  policy?: AtlasRetryPolicy;
}
