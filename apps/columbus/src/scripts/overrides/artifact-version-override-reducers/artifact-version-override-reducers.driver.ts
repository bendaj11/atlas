import type { ArtifactVersion } from '../../../types/artifact-version';
import type { Artifact } from '../../../types/artifact';
import type { ColumbusState, Scope } from '../../../types/columbus-state';
import { aColumbusState } from '../../../types/columbus-state.testkit';
import {
  clearAllArtifactVersionOverrides,
  clearArtifactVersionOverride,
  saveArtifactVersionOverride,
  setArtifactVersionOverrideScope,
  toggleArtifactVersionOverride,
} from './artifact-version-override-reducers';

export class ArtifactVersionOverrideReducersDriver {
  private columbusState: ColumbusState = aColumbusState();
  private result: ColumbusState | undefined;

  readonly given = {
    activeOverride: (artifactKey: string, manifest: ArtifactVersion): this => {
      this.columbusState.enabledArtifactVersionOverrides.set(
        artifactKey,
        manifest,
      );

      return this;
    },
    disabledOverride: (
      artifactKey: string,
      manifest: ArtifactVersion,
    ): this => {
      this.columbusState.disabledArtifactVersionOverrides.set(
        artifactKey,
        manifest,
      );

      return this;
    },
    clearedLocalArtifactIds: (ids: string[]): this => {
      this.columbusState.clearedLocalArtifactIds = new Set(ids);

      return this;
    },
    scope: (scope: Scope): this => {
      this.columbusState.scope = scope;

      return this;
    },
  };

  readonly when = {
    overrideSaved: (
      selection: Pick<
        Artifact,
        'productionArtifactVersion' | 'selectedArtifactVersion'
      >,
    ): void => {
      this.result = saveArtifactVersionOverride({
        columbusState: this.columbusState,
        selection,
      });
    },
    overrideToggled: (artifactKey: string): void => {
      this.result = toggleArtifactVersionOverride({
        columbusState: this.columbusState,
        artifactKey,
      });
    },
    overrideCleared: (artifactKey: string): void => {
      this.result = clearArtifactVersionOverride({
        columbusState: this.columbusState,
        artifactKey,
      });
    },
    allOverridesCleared: (): void => {
      this.result = clearAllArtifactVersionOverrides(this.columbusState);
    },
    scopeSet: (scope: Scope): void => {
      this.result = setArtifactVersionOverrideScope({
        columbusState: this.columbusState,
        scope,
      });
    },
  };

  readonly get = {
    result: (): ColumbusState | undefined => this.result,
    activeOverride: (artifactKey: string): ArtifactVersion | undefined =>
      this.result?.enabledArtifactVersionOverrides.get(artifactKey),
    disabledOverride: (artifactKey: string): ArtifactVersion | undefined =>
      this.result?.disabledArtifactVersionOverrides.get(artifactKey),
    clearedLocalArtifactIds: (): string[] => [
      ...(this.result?.clearedLocalArtifactIds ?? []),
    ],
    scope: (): Scope | undefined => this.result?.scope,
  };
}
