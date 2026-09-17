import { jest } from '@jest/globals';
import type { BootstrapFailure } from '../fatal-error.types.js';
import type { inferSuggestedActionsFromMessage as inferSuggestedActionsFromMessageType } from '../infer-suggested-actions/infer-suggested-actions.js';

const inferSuggestedActionsFromMessage =
  jest.fn<typeof inferSuggestedActionsFromMessageType>();
jest.unstable_mockModule(
  '../infer-suggested-actions/infer-suggested-actions.js',
  () => ({
    inferSuggestedActionsFromMessage,
  }),
);
const { describeFatalError } = await import('./describe-fatal-error.js');

export class DescribeFatalErrorDriver {
  private failure!: BootstrapFailure;

  constructor() {
    inferSuggestedActionsFromMessage.mockReset();
  }

  readonly given = {
    fallbackActions: (actions: string[]): DescribeFatalErrorDriver => {
      inferSuggestedActionsFromMessage.mockReturnValue(actions);

      return this;
    },
  };

  readonly when = {
    described: (error: unknown): void => {
      this.failure = describeFatalError(error);
    },
  };

  readonly get = {
    failure: (): BootstrapFailure => this.failure,
    suggestedActionsForMock: () => inferSuggestedActionsFromMessage,
  };
}
