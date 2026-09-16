import { jest } from '@jest/globals';
import type { ColumbusState } from '../../../types/app';
import type { persistColumbusState as persistColumbusStateType } from '../../../scripts/overrides/persist-overrides';

const persistColumbusState = jest.fn<typeof persistColumbusStateType>();

jest.unstable_mockModule(
  '../../../scripts/overrides/persist-overrides',
  () => ({ persistColumbusState }),
);

const { hasOverrides, overrideStatusOf, persistOverrides } =
  await import('./overrides');

export class OverridesDriver {
  private failure: Error | undefined;

  constructor() {
    jest.clearAllMocks();
    persistColumbusState.mockResolvedValue(undefined);
  }

  readonly given = {
    persistFailure: (reason: string): this => {
      persistColumbusState.mockRejectedValue(new Error(reason));

      return this;
    },
  };

  readonly when = {
    persisted: async (columbusState: ColumbusState): Promise<void> => {
      try {
        await persistOverrides(columbusState);
      } catch (error) {
        this.failure = error as Error;
      }
    },
  };

  readonly get = {
    failureMessage: (): string | undefined => this.failure?.message,
    persistedColumbusState: (): unknown =>
      persistColumbusState.mock.calls[0]?.[0],
    hasOverrides: (columbusState: ColumbusState | undefined): boolean =>
      hasOverrides(columbusState),
    overrideStatus: (mutation: { isError: boolean; isPending: boolean }) =>
      overrideStatusOf(mutation),
  };
}
