import { jest } from '@jest/globals';
import { withExponentialRetry } from './retry.js';

export class RetryDriver {
  private readonly operation = jest.fn<() => Promise<string>>();
  private readonly delays: number[] = [];
  private result?: string;
  private error?: unknown;

  given = {
    transientFailures: (count: number) => {
      let failures = count;
      this.operation.mockImplementation(async () => {
        if (failures-- > 0) {
          throw { $metadata: { httpStatusCode: 503 } };
        }
        return 'completed';
      });
    },
    permanentFailure: () => {
      this.operation.mockRejectedValue({ $metadata: { httpStatusCode: 400 } });
    },
  };

  when = {
    run: async () => {
      try {
        this.result = await withExponentialRetry(this.operation, {
          delay: async (milliseconds) => {
            this.delays.push(milliseconds);
          },
        });
      } catch (error) {
        this.error = error;
      }
    },
  };

  get = {
    execution: () => ({
      result: this.result,
      attempts: this.operation.mock.calls.length,
      delays: this.delays,
    }),
    failure: () => ({
      error: this.error,
      attempts: this.operation.mock.calls.length,
      delays: this.delays,
    }),
  };
}
