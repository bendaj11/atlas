import { emitRuntimeEvent, eventTimestamp, type AtlasRuntimeObserver } from "./observability.js";

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

export class AtlasLoadError extends Error {
  readonly stage: string;
  readonly resource: string | undefined;
  readonly appId: string | undefined;
  readonly version: string | undefined;
  readonly attempts: number;

  constructor(context: AtlasOperationContext, attempts: number, cause: unknown) {
    const details = [
      `stage=${context.stage}`,
      context.appId ? `app=${context.appId}` : undefined,
      context.version ? `version=${context.version}` : undefined,
      context.resource ? `resource=${context.resource}` : undefined,
      `attempts=${attempts}`
    ].filter(Boolean).join(", ");
    super(`Atlas loading failed (${details}): ${errorMessage(cause)}`, { cause });
    this.name = "AtlasLoadError";
    this.stage = context.stage;
    this.resource = context.resource;
    this.appId = context.appId;
    this.version = context.version;
    this.attempts = attempts;
  }
}

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRY_COUNT = 3;
const DEFAULT_RETRY_DELAY_MS = 250;

export function createRetryPolicy(source: AtlasRetryPolicySource, observer?: AtlasRuntimeObserver): AtlasRetryPolicy {
  return {
    ...(source.resourcesTimeoutMs !== undefined ? { timeoutMs: source.resourcesTimeoutMs } : {}),
    ...(source.resourcesRetryCount !== undefined ? { retryCount: source.resourcesRetryCount } : {}),
    ...(observer ? { observer } : {})
  };
}

export async function runResiliently<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  context: AtlasOperationContext,
  policy: AtlasRetryPolicy = {}
): Promise<T> {
  const timeoutMs = policy.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retryCount = policy.retryCount ?? DEFAULT_RETRY_COUNT;
  const retryDelayMs = DEFAULT_RETRY_DELAY_MS;
  validatePolicy({ timeoutMs, retryCount });

  const totalAttempts = retryCount + 1;
  const startedAt = Date.now();
  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    try {
      const result = await withTimeout(operation, timeoutMs, context);
      emitOperationEvent({ ...(policy.observer ? { observer: policy.observer } : {}), type: "operation.success", context, attempt, totalAttempts, startedAt });
      return result;
    } catch (error) {
      const failure = toError(error);
      if (attempt === totalAttempts) {
        emitOperationEvent({ ...(policy.observer ? { observer: policy.observer } : {}), type: "operation.error", context, attempt, totalAttempts, startedAt, error: failure });
        throw new AtlasLoadError(context, attempt, failure);
      }
      emitOperationEvent({ ...(policy.observer ? { observer: policy.observer } : {}), type: "operation.retry", context, attempt, totalAttempts, startedAt, error: failure });
      await delay(retryDelayMs);
    }
  }
  throw new Error("Atlas retry loop completed unexpectedly.");
}

interface OperationEventInput {
  observer?: AtlasRuntimeObserver;
  type: "operation.success" | "operation.retry" | "operation.error";
  context: AtlasOperationContext;
  attempt: number;
  totalAttempts: number;
  startedAt: number;
  error?: Error;
}

function emitOperationEvent(input: OperationEventInput): void {
  emitRuntimeEvent(input.observer, {
    type: input.type,
    timestamp: eventTimestamp(),
    stage: input.context.stage,
    attempt: input.attempt,
    maxAttempts: input.totalAttempts,
    durationMs: Date.now() - input.startedAt,
    ...(input.context.resource ? { resource: input.context.resource } : {}),
    ...(input.context.appId ? { appId: input.context.appId } : {}),
    ...(input.context.version ? { version: input.context.version } : {}),
    ...(input.error ? { error: input.error } : {})
  });
}

function validatePolicy(policy: { timeoutMs: number; retryCount: number }): void {
  if (!Number.isInteger(policy.timeoutMs) || policy.timeoutMs < 1) {
    throw new Error("Atlas request timeoutMs must be a positive integer.");
  }
  if (!Number.isInteger(policy.retryCount) || policy.retryCount < 0) {
    throw new Error("Atlas retryCount must be a non-negative integer.");
  }
}

async function withTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  context: AtlasOperationContext
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(controller.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error(`Timed out after ${timeoutMs}ms during ${context.stage}.`));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
