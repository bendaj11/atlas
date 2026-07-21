import { getArtifactKey } from '../contracts.js';
import type { ArtifactSelection, PopupSession, Scope } from './types.js';

export function toggleOverrideInSession({
  session,
  artifactKey,
}: {
  session: PopupSession;
  artifactKey: string;
}): PopupSession | undefined {
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
  session: PopupSession;
  selection: ArtifactSelection;
}): PopupSession {
  const artifactKey = getArtifactKey(selection.productionManifest);
  const activeOverrides = new Map(session.activeOverrides);
  const disabledOverrides = new Map(session.disabledOverrides);
  disabledOverrides.delete(artifactKey);

  if (selection.selectedManifest)
    activeOverrides.set(artifactKey, selection.selectedManifest);
  else activeOverrides.delete(artifactKey);

  return { ...session, activeOverrides, disabledOverrides };
}

export function clearAllOverridesInSession(
  session: PopupSession,
): PopupSession {
  return {
    ...session,
    activeOverrides: new Map(),
    disabledOverrides: new Map(),
  };
}

export function clearOverrideInSession({
  session,
  artifactKey,
}: {
  session: PopupSession;
  artifactKey: string;
}): PopupSession {
  const activeOverrides = new Map(session.activeOverrides);
  const disabledOverrides = new Map(session.disabledOverrides);
  activeOverrides.delete(artifactKey);
  disabledOverrides.delete(artifactKey);
  return { ...session, activeOverrides, disabledOverrides };
}

export function setOverrideScopeInSession({
  session,
  scope,
}: {
  session: PopupSession;
  scope: Scope;
}): PopupSession {
  return { ...session, scope };
}
