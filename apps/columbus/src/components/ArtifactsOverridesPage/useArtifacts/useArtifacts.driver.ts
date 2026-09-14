import { jest } from '@jest/globals';
import { act, renderHook, type RenderHookResult } from '@testing-library/react';
import type { Artifact, ExtensionSession, Manifest } from '../../../types/app';
import { aManifest, aSession } from '../../../types/app.testkit';
import { getArtifactKey } from '../../../types/contracts';
import type { useSession as useSessionType } from '../../providers/SessionContext/SessionContext';

const useSession = jest.fn<typeof useSessionType>();

jest.unstable_mockModule(
  '../../providers/SessionContext/SessionContext',
  () => ({ useSession }),
);

const { useArtifacts } = await import('./useArtifacts');

type SessionValue = ReturnType<typeof useSessionType>;
type HookResult = ReturnType<typeof useArtifacts>;

export class UseArtifactsDriver {
  private session: ExtensionSession | undefined = aSession();
  private hook: RenderHookResult<HookResult, undefined> | undefined;

  readonly given = {
    noSession: (): this => {
      this.session = undefined;

      return this;
    },
    app: (overrides: Partial<Manifest> = {}): Manifest => {
      const app = aManifest({ kind: 'app', ...overrides });
      this.session!.hostData.catalog.apps.push(app);

      return app;
    },
    widgetProvider: (): Manifest => {
      const provider = aManifest({ kind: 'app' });
      this.session!.hostData.catalog.widgetProviders = [provider];

      return provider;
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
    visibleAppIds: (...ids: string[]): this => {
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
    artifactIds: (): string[] =>
      this.get.artifacts().map((artifact) => artifact.id),
    artifact: (manifest: Manifest): Artifact => {
      const key = getArtifactKey(manifest);
      const artifact = this.get.artifacts().find((item) => item.id === key);
      if (!artifact) throw new Error(`Artifact ${key} was not produced.`);

      return artifact;
    },
    totalCount: (): number => this.get.result().totalCount,
    visibleOnly: (): boolean => this.get.result().visibleOnly,
    host: (): Manifest => this.session!.hostData.catalog.host,
  };
}
