import { jest } from '@jest/globals';
import type { BootstrapFailure } from './fatal-error.types.js';
import type { suggestedActionsFor as suggestedActionsForType } from './suggested-actions-for.js';

const suggestedActionsFor = jest.fn<typeof suggestedActionsForType>();
jest.unstable_mockModule('./suggested-actions-for.js', () => ({
  suggestedActionsFor,
}));
const { describeFatalError } = await import('./describe-fatal-error.js');

export class DescribeFatalErrorDriver {
  private failure!: BootstrapFailure;

  constructor() {
    suggestedActionsFor.mockReset();
  }

  readonly given = {
    fallbackActions: (actions: string[]): DescribeFatalErrorDriver => {
      suggestedActionsFor.mockReturnValue(actions);

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
    suggestedActionsForMock: () => suggestedActionsFor,
  };
}
