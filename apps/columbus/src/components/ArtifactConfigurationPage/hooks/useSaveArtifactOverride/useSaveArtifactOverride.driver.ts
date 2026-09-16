import { jest } from '@jest/globals';
import { act, renderHook, type RenderHookResult } from '@testing-library/react';
import type { ArtifactConfiguration } from '../../../../types/artifact';
import type { OverrideStatus } from '../../../../state/overrides/overrides';
import { anArtifactConfiguration } from '../../../../types/artifact.testkit';
import type { useOverrides as useOverridesType } from '../../../../state';
import type { useSaveArtifactOverrideMutation as useSaveArtifactOverrideMutationType } from '../useSaveArtifactOverrideMutation/useSaveArtifactOverrideMutation';

const useOverrides = jest.fn<typeof useOverridesType>();
const useSaveArtifactOverrideMutation =
  jest.fn<typeof useSaveArtifactOverrideMutationType>();

jest.unstable_mockModule('../../../../state', () => ({ useOverrides }));
jest.unstable_mockModule(
  '../useSaveArtifactOverrideMutation/useSaveArtifactOverrideMutation',
  () => ({ useSaveArtifactOverrideMutation }),
);

const { useSaveArtifactOverride } = await import('./useSaveArtifactOverride');

type OverridesValue = ReturnType<typeof useOverridesType>;
type MutationResult = ReturnType<typeof useSaveArtifactOverrideMutationType>;

export class UseSaveArtifactOverrideDriver {
  private configuration: ArtifactConfiguration | undefined =
    anArtifactConfiguration();
  private overrideStatus: OverrideStatus = 'IDLE';
  private overrideMessage = '';
  private mutationError: Error | null = null;
  private mutationPending = false;
  private readonly saveOverride = jest.fn<OverridesValue['saveOverride']>();
  private readonly mutateAsync = jest.fn<MutationResult['mutateAsync']>();
  private hook!: RenderHookResult<
    ReturnType<typeof useSaveArtifactOverride>,
    undefined
  >;

  constructor() {
    this.saveOverride.mockResolvedValue(undefined);
    this.mutateAsync.mockResolvedValue(undefined);
  }

  readonly given = {
    configuration: (configuration: ArtifactConfiguration | undefined): this => {
      this.configuration = configuration;

      return this;
    },
    overrideStatus: (status: OverrideStatus): this => {
      this.overrideStatus = status;

      return this;
    },
    overrideMessage: (message: string): this => {
      this.overrideMessage = message;

      return this;
    },
    mutationError: (error: Error | null): this => {
      this.mutationError = error;

      return this;
    },
    mutationPending: (pending: boolean): this => {
      this.mutationPending = pending;

      return this;
    },
    mutationFailure: (reason: string): this => {
      this.mutateAsync.mockRejectedValue(new Error(reason));

      return this;
    },
  };

  readonly when = {
    rendered: (): void => {
      useOverrides.mockReturnValue({
        message: this.overrideMessage,
        status: this.overrideStatus,
        saveOverride: this.saveOverride,
      } as Partial<OverridesValue> as OverridesValue);
      useSaveArtifactOverrideMutation.mockReturnValue({
        error: this.mutationError,
        isPending: this.mutationPending,
        mutateAsync: this.mutateAsync,
      } as Partial<MutationResult> as MutationResult);
      this.hook = renderHook(() =>
        useSaveArtifactOverride({
          configuration: this.configuration,
          selection: { type: 'custom', value: '' },
        }),
      );
    },
    overrideCleared: async (): Promise<void> => {
      await act(() => this.get.result().clearOverride());
    },
    saved: async (): Promise<void> => {
      await act(() => this.get.result().save());
    },
  };

  readonly get = {
    result: () => this.hook.result.current,
    saveOverride: () => this.saveOverride,
    mutateAsync: () => this.mutateAsync,
  };
}
