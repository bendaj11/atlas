import { jest } from '@jest/globals';
import { withExponentialRetry } from './retry.js';

export class RetryDriver {
  private readonly operation = jest.fn<() => Promise<string>>();
  private readonly delays: number[] = [];
  private result?: string;
  private error?: unknown;

  given = {
    transientFailures: (count: number): void => {
      let failures = count;
      this.operation.mockImplementation(async () => {
        if (failures-- > 0) {
          throw { $metadata: { httpStatusCode: 503 } };
        }
        return 'completed';
      });
    },
    permanentFailure: (): void => {
      this.operation.mockRejectedValue({ $metadata: { httpStatusCode: 400 } });
    },
  };

  when = {
    run: async (): Promise<void> => {
      try {
        this.result = await withExponentialRetry(this.operation, {
          wait: async (milliseconds) => {
            this.delays.push(milliseconds);
          },
        });
      } catch (error) {
        this.error = error;
      }
    },
  };

  get = {
    execution: (): { result?: string; attempts: number; delays: number[] } => ({
      result: this.result,
      attempts: this.operation.mock.calls.length,
      delays: this.delays,
    }),
    failure: (): { error: unknown; attempts: number; delays: number[] } => ({
      error: this.error,
      attempts: this.operation.mock.calls.length,
      delays: this.delays,
    }),
  };
}
