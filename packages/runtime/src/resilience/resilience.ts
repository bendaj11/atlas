import {
  emitRuntimeEvent,
  eventTimestamp,
} from '../observability/observability.js';
import type {
  AtlasOperationEventType,
  AtlasRuntimeObserver,
} from '../observability/observability.types.js';
import { convertToError, isRetryableFailure } from '../shared/errors.js';
import {
  AtlasInvalidRetryCountError,
  AtlasInvalidTimeoutError,
  AtlasLoadError,
  AtlasRetryStateError,
} from './resilience.errors.js';
import type {
  AtlasOperationContext,
  AtlasRetryPolicy,
  AtlasRetryPolicySource,
  ResilientOperation,
  ResilientOperationRunner,
} from './resilience.types.js';

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRY_COUNT = 3;
const DEFAULT_RETRY_DELAY_MS = 250;

export function createRetryPolicy(
  source: AtlasRetryPolicySource,
  observer?: AtlasRuntimeObserver,
): AtlasRetryPolicy {
  return {
    ...(source.resourcesTimeoutMs !== undefined
      ? { timeoutMs: source.resourcesTimeoutMs }
      : {}),
    ...(source.resourcesRetryCount !== undefined
      ? { retryCount: source.resourcesRetryCount }
      : {}),
    ...(observer ? { observer } : {}),
  };
}

export async function runResiliently<T>(
  input: ResilientOperation<T>,
): Promise<T> {
  const { operation, context } = input;
  const policy = input.policy ?? {};
  const timeoutMs = policy.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retryCount = policy.retryCount ?? DEFAULT_RETRY_COUNT;

  assertRetryPolicyIsValid({ timeoutMs, retryCount });

  const totalAttempts = retryCount + 1;
  const startedAt = Date.now();
  const report = (
    type: AtlasOperationEventType,
    attempt: number,
    error?: Error,
  ) =>
    emitOperationEvent({
      ...(policy.observer ? { observer: policy.observer } : {}),
      type,
      context,
      attempt,
      totalAttempts,
      startedAt,
      ...(error ? { error } : {}),
    });

  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    try {
      const result = await runWithTimeout({ operation, timeoutMs, context });

      report('operation.success', attempt);

      return result;
    } catch (error) {
      const failure = convertToError(error);

      if (attempt === totalAttempts || !isRetryableFailure(failure)) {
        report('operation.error', attempt, failure);

        throw new AtlasLoadError({
          context,
          attempts: attempt,
          cause: failure,
        });
      }

      report('operation.retry', attempt, failure);

      await sleep(DEFAULT_RETRY_DELAY_MS);
    }
  }

  throw new AtlasRetryStateError();
}

interface OperationEventInput {
  observer?: AtlasRuntimeObserver;
  type: AtlasOperationEventType;
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
    ...(input.error ? { error: input.error } : {}),
  });
}

function assertRetryPolicyIsValid(policy: {
  timeoutMs: number;
  retryCount: number;
}): void {
  if (!Number.isInteger(policy.timeoutMs) || policy.timeoutMs < 1)
    throw new AtlasInvalidTimeoutError(policy.timeoutMs);

  if (!Number.isInteger(policy.retryCount) || policy.retryCount < 0)
    throw new AtlasInvalidRetryCountError(policy.retryCount);
}

async function runWithTimeout<T>(input: {
  operation: ResilientOperationRunner<T>;
  timeoutMs: number;
  context: AtlasOperationContext;
}): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      input.operation(controller.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();

          reject(
            new Error(
              `Timed out after ${input.timeoutMs}ms during ${input.context.stage}.`,
            ),
          );
        }, input.timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
