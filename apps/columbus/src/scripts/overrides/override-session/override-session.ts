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
  disabledOverrides.delete(artifactKey);

  if (selection.selectedManifest)
    activeOverrides.set(artifactKey, selection.selectedManifest);
  else activeOverrides.delete(artifactKey);

  return { ...session, activeOverrides, disabledOverrides };
}

export function clearAllOverridesInSession(
  session: ExtensionSession,
): ExtensionSession {
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
  session: ExtensionSession;
  artifactKey: string;
}): ExtensionSession {
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
  session: ExtensionSession;
  scope: Scope;
}): ExtensionSession {
  return { ...session, scope };
}
