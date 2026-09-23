import { jest } from '@jest/globals';
import { faker } from '@faker-js/faker';
import type {
  AtlasOperationEvent,
  AtlasRuntimeObserver,
} from '../observability/observability.types.js';
import { runResiliently } from './resilience.js';
import type {
  AtlasOperationContext,
  AtlasRetryPolicy,
  ResilientOperationRunner,
} from './resilience.types.js';

export class ResilienceDriver {
  private context: AtlasOperationContext = { stage: faker.word.noun() };
  private policy: AtlasRetryPolicy = { retryCount: 0, timeoutMs: 50 };
  private readonly observer = jest.fn<AtlasRuntimeObserver>();
  private readonly operation = jest.fn<ResilientOperationRunner<unknown>>();
  private result: unknown;
  private error: unknown;

  readonly given = {
    context: (context: AtlasOperationContext) => {
      this.context = context;

      return this;
    },
    policy: (policy: AtlasRetryPolicy) => {
      this.policy = policy;

      return this;
    },
    observerThrowing: () => {
      this.observer.mockImplementation(() => {
        throw new Error('monitor unavailable');
      });

      return this;
    },
    operationResults: (results: Array<unknown | Error>) => {
      for (const result of results) {
        if (result instanceof Error)
          this.operation.mockRejectedValueOnce(result);
        else this.operation.mockResolvedValueOnce(result);
      }

      return this;
    },
    operationHanging: () => {
      this.operation.mockImplementation(() => new Promise(() => undefined));

      return this;
    },
  };

  readonly when = {
    run: async () => {
      try {
        this.result = await runResiliently({
          operation: this.operation,
          context: this.context,
          policy: { ...this.policy, observer: this.observer },
        });
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    result: () => this.result,
    error: () => this.error,
    operationMock: () => this.operation,
    observerMock: () => this.observer,
    eventTypes: () => this.observer.mock.calls.map(([event]) => event.type),
    eventAttempts: () =>
      this.observer.mock.calls.map(([event]) =>
        isOperationEvent(event) ? event.attempt : undefined,
      ),
    signals: () => this.operation.mock.calls.map(([signal]) => signal),
  };
}

function isOperationEvent(
  event: Parameters<AtlasRuntimeObserver>[0],
): event is AtlasOperationEvent {
  return event.type.startsWith('operation.');
}
