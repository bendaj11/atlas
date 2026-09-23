import { jest } from '@jest/globals';
import { act, renderHook, type RenderHookResult } from '@testing-library/react';
import type { AtlasHostManifest, AtlasManifest } from '@atlas/schema';
import type { ColumbusState } from '../../../types/columbus-state';
import type { ArtifactVersion } from '../../../types/artifact-version';
import { aColumbusState } from '../../../testkit/columbus-state.testkit';
import { useColumbusStateMock } from '../../../testkit/mocks/useColumbusState';

const { useArtifacts } = await import('./useArtifacts');

export class UseArtifactsDriver {
  private columbusState: ColumbusState | undefined = aColumbusState();
  private hook!: RenderHookResult<ReturnType<typeof useArtifacts>, undefined>;

  readonly given = {
    columbusState: (columbusState: ColumbusState | undefined) => {
      this.columbusState = columbusState;

      return this;
    },
    catalogHost: (manifest: AtlasHostManifest) => {
      this.columbusState!.hostData.catalog.host = manifest;

      return this;
    },
    catalogApp: (manifest: AtlasManifest) => {
      this.columbusState!.hostData.catalog.apps.push(manifest);

      return this;
    },
    catalogWidgetProvider: (manifest: AtlasManifest) => {
      this.columbusState!.hostData.catalog.widgetProviders = [manifest];

      return this;
    },
    enabledOverride: (manifest: ArtifactVersion, override: ArtifactVersion) => {
      this.columbusState!.enabledArtifactVersionOverrides.set(
        manifest.id,
        override,
      );

      return this;
    },
    disabledOverride: (
      manifest: ArtifactVersion,
      override: ArtifactVersion,
    ) => {
      this.columbusState!.disabledArtifactVersionOverrides.set(
        manifest.id,
        override,
      );

      return this;
    },
    runtimeError: (manifest: ArtifactVersion, message: string) => {
      this.columbusState!.hostData.runtimeErrors.push({
        artifactId: manifest.id,
        message,
      });

      return this;
    },
    visibleAppIds: (ids: string[]) => {
      this.columbusState!.hostData.visibleAppIds = ids;

      return this;
    },
  };

  readonly when = {
    rendered: () => {
      useColumbusStateMock.mockReturnValue({
        columbusState: this.columbusState,
        setColumbusState: jest.fn(),
      });
      this.hook = renderHook(() => useArtifacts());
    },
    searched: (value: string) => {
      act(() => this.get.result().setSearchValue(value));
    },
    visibleOnlyChanged: (visibleOnly: boolean) => {
      act(() => this.get.result().setVisibleOnly(visibleOnly));
    },
  };

  readonly get = {
    result: () => this.hook.result.current,
    deployedArtifactVersions: () =>
      this.get
        .result()
        .artifacts.map((artifact) => artifact.deployedArtifactVersion),
    artifactOf: (manifest: ArtifactVersion) => {
      const artifact = this.get
        .result()
        .artifacts.find((item) => item.deployedArtifactVersion === manifest);
      if (!artifact) throw new Error(`No artifact for ${manifest.name}.`);

      return artifact;
    },
  };
}
