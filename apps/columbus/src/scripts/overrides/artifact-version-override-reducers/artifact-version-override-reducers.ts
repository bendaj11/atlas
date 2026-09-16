import { getArtifactKey } from '../../../types/contracts';
import type { Artifact, ColumbusState, Scope } from '../../../types/app';

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
    Artifact,
    'productionArtifactVersion' | 'selectedArtifactVersion'
  >;
}): ColumbusState {
  const artifactKey = getArtifactKey(selection.productionArtifactVersion);
  const enabledArtifactVersionOverrides = new Map(
    columbusState.enabledArtifactVersionOverrides,
  );
  const disabledArtifactVersionOverrides = new Map(
    columbusState.disabledArtifactVersionOverrides,
  );
  const clearedLocalArtifactIds = new Set(
    columbusState.clearedLocalArtifactIds,
  );
  disabledArtifactVersionOverrides.delete(artifactKey);
  clearedLocalArtifactIds.delete(selection.productionArtifactVersion.id);

  if (selection.selectedArtifactVersion)
    enabledArtifactVersionOverrides.set(
      artifactKey,
      selection.selectedArtifactVersion,
    );
  else enabledArtifactVersionOverrides.delete(artifactKey);

  return {
    ...columbusState,
    enabledArtifactVersionOverrides,
    disabledArtifactVersionOverrides,
    clearedLocalArtifactIds,
  };
}

export function clearAllArtifactVersionOverrides(
  columbusState: ColumbusState,
): ColumbusState {
  const clearedLocalArtifactIds = new Set(
    columbusState.clearedLocalArtifactIds,
  );
  for (const artifactVersion of [
    ...columbusState.enabledArtifactVersionOverrides.values(),
    ...columbusState.disabledArtifactVersionOverrides.values(),
  ]) {
    if (artifactVersion.channel === 'local')
      clearedLocalArtifactIds.add(artifactVersion.id);
  }
  return {
    ...columbusState,
    enabledArtifactVersionOverrides: new Map(),
    disabledArtifactVersionOverrides: new Map(),
    clearedLocalArtifactIds,
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
  const selectedArtifactVersion =
    enabledArtifactVersionOverrides.get(artifactKey) ??
    disabledArtifactVersionOverrides.get(artifactKey);
  const clearedLocalArtifactIds = new Set(
    columbusState.clearedLocalArtifactIds,
  );
  enabledArtifactVersionOverrides.delete(artifactKey);
  disabledArtifactVersionOverrides.delete(artifactKey);
  if (selectedArtifactVersion?.channel === 'local')
    clearedLocalArtifactIds.add(selectedArtifactVersion.id);
  return {
    ...columbusState,
    enabledArtifactVersionOverrides,
    disabledArtifactVersionOverrides,
    clearedLocalArtifactIds,
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
