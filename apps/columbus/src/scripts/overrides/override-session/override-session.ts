import { getArtifactKey } from '../../../types/contracts.js';
import type {
  ArtifactSelection,
  ExtensionSession,
  Scope,
} from '../../../types/app.js';

export function toggleOverrideInSession({
  session,
  artifactKey,
}: {
  session: ExtensionSession;
  artifactKey: string;
}): ExtensionSession | undefined {
  const activeOverrides = new Map(session.activeOverrides);
  const disabledOverrides = new Map(session.disabledOverrides);
  const activeManifest = activeOverrides.get(artifactKey);

  if (activeManifest) {
    disabledOverrides.set(artifactKey, activeManifest);
    activeOverrides.delete(artifactKey);
  } else {
    const disabledManifest = disabledOverrides.get(artifactKey);
    if (!disabledManifest) return undefined;
    activeOverrides.set(artifactKey, disabledManifest);
    disabledOverrides.delete(artifactKey);
  }

  return { ...session, activeOverrides, disabledOverrides };
}

export function saveOverrideInSession({
  session,
  selection,
}: {
  session: ExtensionSession;
  selection: ArtifactSelection;
}): ExtensionSession {
  const artifactKey = getArtifactKey(selection.productionManifest);
  const activeOverrides = new Map(session.activeOverrides);
  const disabledOverrides = new Map(session.disabledOverrides);
  const suppressedArtifactIds = new Set(session.suppressedArtifactIds);
  disabledOverrides.delete(artifactKey);
  suppressedArtifactIds.delete(selection.productionManifest.id);

  if (selection.selectedManifest)
    activeOverrides.set(artifactKey, selection.selectedManifest);
  else activeOverrides.delete(artifactKey);

  return {
    ...session,
    activeOverrides,
    disabledOverrides,
    suppressedArtifactIds,
  };
}

export function clearAllOverridesInSession(
  session: ExtensionSession,
): ExtensionSession {
  const suppressedArtifactIds = new Set(session.suppressedArtifactIds);
  for (const manifest of [
    ...session.activeOverrides.values(),
    ...session.disabledOverrides.values(),
  ]) {
    if (manifest.channel === 'local') suppressedArtifactIds.add(manifest.id);
  }
  return {
    ...session,
    activeOverrides: new Map(),
    disabledOverrides: new Map(),
    suppressedArtifactIds,
  };
}

export function clearOverrideInSession({
  session,
  artifactKey,
}: {
  session: ExtensionSession;
  artifactKey: string;
}): ExtensionSession {
  const activeOverrides = new Map(session.activeOverrides);
  const disabledOverrides = new Map(session.disabledOverrides);
  const selectedManifest =
    activeOverrides.get(artifactKey) ?? disabledOverrides.get(artifactKey);
  const suppressedArtifactIds = new Set(session.suppressedArtifactIds);
  activeOverrides.delete(artifactKey);
  disabledOverrides.delete(artifactKey);
  if (selectedManifest?.channel === 'local')
    suppressedArtifactIds.add(selectedManifest.id);
  return {
    ...session,
    activeOverrides,
    disabledOverrides,
    suppressedArtifactIds,
  };
}

export function setOverrideScopeInSession({
  session,
  scope,
}: {
  session: ExtensionSession;
  scope: Scope;
}): ExtensionSession {
  return { ...session, scope };
}
