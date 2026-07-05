import { emitRuntimeEvent, eventTimestamp, type AtlasRuntimeObserver } from "./observability.js";

export interface AtlasRetryPolicy {
  timeoutMs?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
  observer?: AtlasRuntimeObserver;
}

export interface AtlasRetryPolicySource {
  requestTimeoutMs?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
}

export interface AtlasOperationContext {
  stage: string;
  resource?: string;
  mfId?: string;
  version?: string;
}

export class AtlasLoadError extends Error {
  readonly stage: string;
  readonly resource: string | undefined;
  readonly mfId: string | undefined;
  readonly version: string | undefined;
  readonly attempts: number;

  constructor(context: AtlasOperationContext, attempts: number, cause: unknown) {
    const details = [
      `stage=${context.stage}`,
      context.mfId ? `mf=${context.mfId}` : undefined,
      context.version ? `version=${context.version}` : undefined,
      context.resource ? `resource=${context.resource}` : undefined,
      `attempts=${attempts}`
    ].filter(Boolean).join(", ");
    super(`Atlas loading failed (${details}): ${errorMessage(cause)}`, { cause });
    this.name = "AtlasLoadError";
    this.stage = context.stage;
    this.resource = context.resource;
    this.mfId = context.mfId;
    this.version = context.version;
    this.attempts = attempts;
  }
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRY_ATTEMPTS = 2;
const DEFAULT_RETRY_DELAY_MS = 250;

export function createRetryPolicy(source: AtlasRetryPolicySource, observer?: AtlasRuntimeObserver): AtlasRetryPolicy {
  return {
    ...(source.requestTimeoutMs !== undefined ? { timeoutMs: source.requestTimeoutMs } : {}),
    ...(source.retryAttempts !== undefined ? { retryAttempts: source.retryAttempts } : {}),
    ...(source.retryDelayMs !== undefined ? { retryDelayMs: source.retryDelayMs } : {}),
    ...(observer ? { observer } : {})
  };
}

export async function runResiliently<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  context: AtlasOperationContext,
  policy: AtlasRetryPolicy = {}
): Promise<T> {
  const timeoutMs = policy.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retryAttempts = policy.retryAttempts ?? DEFAULT_RETRY_ATTEMPTS;
  const retryDelayMs = policy.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  validatePolicy({ timeoutMs, retryAttempts, retryDelayMs });

  const totalAttempts = retryAttempts + 1;
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
    ...(input.context.mfId ? { mfId: input.context.mfId } : {}),
    ...(input.context.version ? { version: input.context.version } : {}),
    ...(input.error ? { error: input.error } : {})
  });
}

function validatePolicy(policy: { timeoutMs: number; retryAttempts: number; retryDelayMs: number }): void {
  if (!Number.isInteger(policy.timeoutMs) || policy.timeoutMs < 1) {
    throw new Error("Atlas request timeoutMs must be a positive integer.");
  }
  if (!Number.isInteger(policy.retryAttempts) || policy.retryAttempts < 0) {
    throw new Error("Atlas retryAttempts must be a non-negative integer.");
  }
  if (!Number.isInteger(policy.retryDelayMs) || policy.retryDelayMs < 0) {
    throw new Error("Atlas retryDelayMs must be a non-negative integer.");
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
