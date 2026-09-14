import type { AtlasExtensionManifest as Manifest } from '../../../types/contracts';
import type {
  ArtifactSelection,
  ExtensionSession,
  Scope,
} from '../../../types/app';
import { aSession } from '../../../types/app.testkit';
import {
  clearAllOverridesInSession,
  clearOverrideInSession,
  saveOverrideInSession,
  setOverrideScopeInSession,
  toggleOverrideInSession,
} from './override-session';

export class OverrideSessionDriver {
  private session: ExtensionSession = aSession();
  private result: ExtensionSession | undefined;

  readonly given = {
    activeOverride: (artifactKey: string, manifest: Manifest): this => {
      this.session.activeOverrides.set(artifactKey, manifest);

      return this;
    },
    disabledOverride: (artifactKey: string, manifest: Manifest): this => {
      this.session.disabledOverrides.set(artifactKey, manifest);

      return this;
    },
    suppressedArtifactIds: (ids: string[]): this => {
      this.session.suppressedArtifactIds = new Set(ids);

      return this;
    },
    scope: (scope: Scope): this => {
      this.session.scope = scope;

      return this;
    },
  };

  readonly when = {
    overrideSaved: (selection: ArtifactSelection): this => {
      this.result = saveOverrideInSession({ session: this.session, selection });

      return this;
    },
    overrideToggled: (artifactKey: string): this => {
      this.result = toggleOverrideInSession({
        session: this.session,
        artifactKey,
      });

      return this;
    },
    overrideCleared: (artifactKey: string): this => {
      this.result = clearOverrideInSession({
        session: this.session,
        artifactKey,
      });

      return this;
    },
    allOverridesCleared: (): this => {
      this.result = clearAllOverridesInSession(this.session);

      return this;
    },
    scopeSet: (scope: Scope): this => {
      this.result = setOverrideScopeInSession({ session: this.session, scope });

      return this;
    },
  };

  readonly get = {
    result: (): ExtensionSession | undefined => this.result,
    activeOverride: (artifactKey: string): Manifest | undefined =>
      this.result?.activeOverrides.get(artifactKey),
    disabledOverride: (artifactKey: string): Manifest | undefined =>
      this.result?.disabledOverrides.get(artifactKey),
    suppressedArtifactIds: (): string[] => [
      ...(this.result?.suppressedArtifactIds ?? []),
    ],
    scope: (): Scope | undefined => this.result?.scope,
  };
}
