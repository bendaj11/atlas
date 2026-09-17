import { jest } from '@jest/globals';
import type { BootstrapFailure } from '../fatal-error.types.js';
import type { suggestedActionsForMessage as suggestedActionsForType } from '../suggested-actions-for-message/suggested-actions-for-message.js';

const suggestedActionsForMessage = jest.fn<typeof suggestedActionsForType>();
jest.unstable_mockModule(
  '../suggested-actions-for-message/suggested-actions-for-message.js',
  () => ({
    suggestedActionsForMessage,
  }),
);
const { describeFatalError } = await import('./describe-fatal-error.js');

export class DescribeFatalErrorDriver {
  private failure!: BootstrapFailure;

  constructor() {
    suggestedActionsForMessage.mockReset();
  }

  readonly given = {
    fallbackActions: (actions: string[]): DescribeFatalErrorDriver => {
      suggestedActionsForMessage.mockReturnValue(actions);

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
    suggestedActionsForMock: () => suggestedActionsForMessage,
  };
}
