import { jest } from '@jest/globals';
import { notifyManager, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, type RenderHookResult } from '@testing-library/react';
import type { ReactNode } from 'react';
import type {
  ArtifactConfiguration,
  OverrideSelection,
} from '../../../types/artifact';
import type { ColumbusState } from '../../../types/columbus-state';
import type { ArtifactVersion } from '../../../types/artifact-version';
import { anArtifactConfiguration } from '../../../types/artifact.testkit';
import { aColumbusState } from '../../../types/columbus-state.testkit';
import type { loadArtifactVersionFromHostTab as loadArtifactVersionFromHostTabType } from '../../../scripts/host/host-tabs/host-tabs';
import type {
  useOverrides as useOverridesType,
  useColumbusState as useColumbusStateType,
} from '../../../state';
import { createQueryClient } from '../../../state/query-client/query-client';

const useOverrides = jest.fn<typeof useOverridesType>();
const useColumbusState = jest.fn<typeof useColumbusStateType>();
const loadArtifactVersionFromHostTab =
  jest.fn<typeof loadArtifactVersionFromHostTabType>();

jest.unstable_mockModule('../../../state', () => ({
  useOverrides,
  useColumbusState,
}));
jest.unstable_mockModule('../../../scripts/host/host-tabs/host-tabs', () => ({
  loadArtifactVersionFromHostTab,
}));

const { useSaveArtifactOverrideMutation } =
  await import('./useSaveArtifactOverrideMutation');

notifyManager.setScheduler((callback) => callback());

type OverridesValue = ReturnType<typeof useOverridesType>;
type ColumbusStateValue = ReturnType<typeof useColumbusStateType>;

export class UseSaveArtifactOverrideMutationDriver {
  private columbusState: ColumbusState | undefined = aColumbusState();
  private configuration: ArtifactConfiguration | undefined =
    anArtifactConfiguration();
  private selection: OverrideSelection = { type: 'custom', value: '' };
  private readonly saveOverride = jest.fn<OverridesValue['saveOverride']>();
  private hook!: RenderHookResult<
    ReturnType<typeof useSaveArtifactOverrideMutation>,
    undefined
  >;

  constructor() {
    loadArtifactVersionFromHostTab.mockReset();
    this.saveOverride.mockResolvedValue(undefined);
  }

  readonly given = {
    columbusState: (columbusState: ColumbusState | undefined): this => {
      this.columbusState = columbusState;

      return this;
    },
    configuration: (configuration: ArtifactConfiguration | undefined): this => {
      this.configuration = configuration;

      return this;
    },
    selection: (selection: OverrideSelection): this => {
      this.selection = selection;

      return this;
    },
    loadedManifest: (manifest: ArtifactVersion): this => {
      loadArtifactVersionFromHostTab.mockResolvedValue(manifest);

      return this;
    },
    manifestLoadFailure: (reason: string): this => {
      loadArtifactVersionFromHostTab.mockRejectedValue(new Error(reason));

      return this;
    },
    manifestLoadPending: (): this => {
      loadArtifactVersionFromHostTab.mockReturnValue(new Promise(() => {}));

      return this;
    },
  };

  readonly when = {
    rendered: (): void => {
      useColumbusState.mockReturnValue({
        columbusState: this.columbusState,
      } as ColumbusStateValue);
      useOverrides.mockReturnValue({
        saveOverride: this.saveOverride,
      } as Partial<OverridesValue> as OverridesValue);
      const queryClient = createQueryClient();
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );
      this.hook = renderHook(
        () =>
          useSaveArtifactOverrideMutation({
            configuration: this.configuration,
            selection: this.selection,
          }),
        { wrapper },
      );
    },
    mutated: async (): Promise<void> => {
      await act(() =>
        this.get
          .result()
          .mutateAsync()
          .catch(() => undefined),
      );
    },
    mutationStarted: async (): Promise<void> => {
      await act(async () => {
        void this.get
          .result()
          .mutateAsync()
          .catch(() => undefined);
      });
    },
  };

  readonly get = {
    result: () => this.hook.result.current,
    saveOverride: () => this.saveOverride,
    loadArtifactVersionFromHostTab: () => loadArtifactVersionFromHostTab,
  };
}
