import type { ArtifactOverride } from '../../types/artifact';
import type { ColumbusState, Scope } from '../../types/columbus-state';

export function toggleArtifactVersionOverride({
  columbusState,
  artifactKey,
}: {
  columbusState: ColumbusState;
  artifactKey: string;
}): ColumbusState | undefined {
  const enabledArtifactVersionOverrides = new Map(
    columbusState.enabledArtifactVersionOverrides,
  );
  const disabledArtifactVersionOverrides = new Map(
    columbusState.disabledArtifactVersionOverrides,
  );
  const enabledArtifactVersion =
    enabledArtifactVersionOverrides.get(artifactKey);

  if (enabledArtifactVersion) {
    disabledArtifactVersionOverrides.set(artifactKey, enabledArtifactVersion);
    enabledArtifactVersionOverrides.delete(artifactKey);
  } else {
    const disabledArtifactVersion =
      disabledArtifactVersionOverrides.get(artifactKey);
    if (!disabledArtifactVersion) return undefined;
    enabledArtifactVersionOverrides.set(artifactKey, disabledArtifactVersion);
    disabledArtifactVersionOverrides.delete(artifactKey);
  }

  return {
    ...columbusState,
    enabledArtifactVersionOverrides,
    disabledArtifactVersionOverrides,
  };
}

export function saveArtifactVersionOverride({
  columbusState,
  selection,
}: {
  columbusState: ColumbusState;
  selection: Pick<
    ArtifactOverride,
    'deployedArtifactVersion' | 'selectedOverrideArtifactVersion'
  >;
}): ColumbusState {
  const artifactKey = selection.deployedArtifactVersion.id;
  const enabledArtifactVersionOverrides = new Map(
    columbusState.enabledArtifactVersionOverrides,
  );
  const disabledArtifactVersionOverrides = new Map(
    columbusState.disabledArtifactVersionOverrides,
  );
  disabledArtifactVersionOverrides.delete(artifactKey);

  if (selection.selectedOverrideArtifactVersion)
    enabledArtifactVersionOverrides.set(
      artifactKey,
      selection.selectedOverrideArtifactVersion,
    );
  else enabledArtifactVersionOverrides.delete(artifactKey);

  return {
    ...columbusState,
    enabledArtifactVersionOverrides,
    disabledArtifactVersionOverrides,
  };
}

export function clearAllArtifactVersionOverrides(
  columbusState: ColumbusState,
): ColumbusState {
  return {
    ...columbusState,
    enabledArtifactVersionOverrides: new Map(),
    disabledArtifactVersionOverrides: new Map(),
  };
}

export function clearArtifactVersionOverride({
  columbusState,
  artifactKey,
}: {
  columbusState: ColumbusState;
  artifactKey: string;
}): ColumbusState {
  const enabledArtifactVersionOverrides = new Map(
    columbusState.enabledArtifactVersionOverrides,
  );
  const disabledArtifactVersionOverrides = new Map(
    columbusState.disabledArtifactVersionOverrides,
  );
  enabledArtifactVersionOverrides.delete(artifactKey);
  disabledArtifactVersionOverrides.delete(artifactKey);

  return {
    ...columbusState,
    enabledArtifactVersionOverrides,
    disabledArtifactVersionOverrides,
  };
}

export function setArtifactVersionOverrideScope({
  columbusState,
  scope,
}: {
  columbusState: ColumbusState;
  scope: Scope;
}): ColumbusState {
  return { ...columbusState, scope };
}
