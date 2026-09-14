import { jest } from '@jest/globals';
import { act, renderHook, type RenderHookResult } from '@testing-library/react';
import type { Artifact, ExtensionSession, Manifest } from '../../../types/app';
import { aSession } from '../../../types/app.testkit';
import { getArtifactKey } from '../../../types/contracts';
import type { useSession as useSessionType } from '../../providers/SessionContext/SessionContext';

const useSession = jest.fn<typeof useSessionType>();

jest.unstable_mockModule(
  '../../providers/SessionContext/SessionContext',
  () => ({
    useSession,
  }),
);

const { useArtifacts } = await import('./useArtifacts');

type SessionValue = ReturnType<typeof useSessionType>;
type HookResult = ReturnType<typeof useArtifacts>;

export class UseArtifactsDriver {
  private session: ExtensionSession | undefined = aSession();
  private hook: RenderHookResult<HookResult, undefined> | undefined;

  readonly given = {
    session: (session: ExtensionSession | undefined): this => {
      this.session = session;

      return this;
    },
    catalogHost: (manifest: Manifest): this => {
      this.session!.hostData.catalog.host = manifest;

      return this;
    },
    catalogApp: (manifest: Manifest): this => {
      this.session!.hostData.catalog.apps.push(manifest);

      return this;
    },
    catalogWidgetProvider: (manifest: Manifest): this => {
      this.session!.hostData.catalog.widgetProviders = [manifest];

      return this;
    },
    activeOverride: (manifest: Manifest, override: Manifest): this => {
      this.session!.activeOverrides.set(getArtifactKey(manifest), override);

      return this;
    },
    disabledOverride: (manifest: Manifest, override: Manifest): this => {
      this.session!.disabledOverrides.set(getArtifactKey(manifest), override);

      return this;
    },
    runtimeError: (manifest: Manifest, message: string): this => {
      this.session!.hostData.runtimeErrors.push({
        artifactId: getArtifactKey(manifest),
        message,
      });

      return this;
    },
    visibleAppIds: (ids: string[]): this => {
      this.session!.hostData.visibleAppIds = ids;

      return this;
    },
  };

  readonly when = {
    rendered: (): this => {
      useSession.mockReturnValue({ session: this.session } as SessionValue);
      this.hook = renderHook(() => useArtifacts());

      return this;
    },
    searched: (value: string): this => {
      act(() => this.get.result().setSearchValue(value));

      return this;
    },
    visibleOnlyToggled: (): this => {
      act(() =>
        this.get.result().setVisibleOnly(!this.get.result().visibleOnly),
      );

      return this;
    },
  };

  readonly get = {
    result: (): HookResult => {
      if (!this.hook) throw new Error('Hook was not rendered.');

      return this.hook.result.current;
    },
    artifacts: (): Artifact[] => this.get.result().artifacts,
    deployedManifests: (): Manifest[] =>
      this.get.artifacts().map((artifact) => artifact.productionManifest),
    artifactOf: (manifest: Manifest): Artifact => {
      const artifact = this.get
        .artifacts()
        .find((item) => item.productionManifest === manifest);
      if (!artifact) throw new Error(`No artifact for ${manifest.name}.`);

      return artifact;
    },
    totalCount: (): number => this.get.result().totalCount,
    visibleOnly: (): boolean => this.get.result().visibleOnly,
  };
}
