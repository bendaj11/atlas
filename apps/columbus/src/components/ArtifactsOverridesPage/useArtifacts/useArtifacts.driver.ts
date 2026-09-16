import { jest } from '@jest/globals';
import { act, renderHook, type RenderHookResult } from '@testing-library/react';
import type { Artifact } from '../../../types/artifact';
import type { ColumbusState } from '../../../types/columbus-state';
import type { ArtifactVersion } from '../../../types/artifact-version';
import { aColumbusState } from '../../../types/columbus-state.testkit';
import { getArtifactKey } from '../../../scripts/artifact-versions/artifact-version-keys/artifact-version-keys';
import type { useColumbusState as useColumbusStateType } from '../../../state/useColumbusState/useColumbusState';

const useColumbusState = jest.fn<typeof useColumbusStateType>();

jest.unstable_mockModule(
  '../../../state/useColumbusState/useColumbusState',
  () => ({
    useColumbusState,
  }),
);

const { useArtifacts } = await import('./useArtifacts');

type ColumbusStateValue = ReturnType<typeof useColumbusStateType>;
type HookResult = ReturnType<typeof useArtifacts>;

export class UseArtifactsDriver {
  private columbusState: ColumbusState | undefined = aColumbusState();
  private hook: RenderHookResult<HookResult, undefined> | undefined;

  readonly given = {
    columbusState: (columbusState: ColumbusState | undefined): this => {
      this.columbusState = columbusState;

      return this;
    },
    catalogHost: (manifest: ArtifactVersion): this => {
      this.columbusState!.hostData.catalog.host = manifest;

      return this;
    },
    catalogApp: (manifest: ArtifactVersion): this => {
      this.columbusState!.hostData.catalog.apps.push(manifest);

      return this;
    },
    catalogWidgetProvider: (manifest: ArtifactVersion): this => {
      this.columbusState!.hostData.catalog.widgetProviders = [manifest];

      return this;
    },
    activeOverride: (
      manifest: ArtifactVersion,
      override: ArtifactVersion,
    ): this => {
      this.columbusState!.enabledArtifactVersionOverrides.set(
        getArtifactKey(manifest),
        override,
      );

      return this;
    },
    disabledOverride: (
      manifest: ArtifactVersion,
      override: ArtifactVersion,
    ): this => {
      this.columbusState!.disabledArtifactVersionOverrides.set(
        getArtifactKey(manifest),
        override,
      );

      return this;
    },
    runtimeError: (manifest: ArtifactVersion, message: string): this => {
      this.columbusState!.hostData.runtimeErrors.push({
        artifactId: getArtifactKey(manifest),
        message,
      });

      return this;
    },
    visibleAppIds: (ids: string[]): this => {
      this.columbusState!.hostData.visibleAppIds = ids;

      return this;
    },
  };

  readonly when = {
    rendered: (): void => {
      useColumbusState.mockReturnValue({
        columbusState: this.columbusState,
      } as ColumbusStateValue);
      this.hook = renderHook(() => useArtifacts());
    },
    searched: (value: string): void => {
      act(() => this.get.result().setSearchValue(value));
    },
    visibleOnlyToggled: (): void => {
      act(() =>
        this.get.result().setVisibleOnly(!this.get.result().visibleOnly),
      );
    },
  };

  readonly get = {
    result: (): HookResult => {
      if (!this.hook) throw new Error('Hook was not rendered.');

      return this.hook.result.current;
    },
    artifacts: (): Artifact[] => this.get.result().artifacts,
    deployedArtifactVersions: (): ArtifactVersion[] =>
      this.get
        .artifacts()
        .map((artifact) => artifact.productionArtifactVersion),
    artifactOf: (manifest: ArtifactVersion): Artifact => {
      const artifact = this.get
        .artifacts()
        .find((item) => item.productionArtifactVersion === manifest);
      if (!artifact) throw new Error(`No artifact for ${manifest.name}.`);

      return artifact;
    },
    totalCount: (): number => this.get.result().totalCount,
    visibleOnly: (): boolean => this.get.result().visibleOnly,
  };
}
