import { artifactKey } from '../contracts.js';
import type { PopupSession, SaveOverrideValue, Scope } from './types.js';

export function toggleOverrideInSession(
  session: PopupSession,
  key: string,
): PopupSession | undefined {
  const activeOverrides = new Map(session.activeOverrides);
  const disabledOverrides = new Map(session.disabledOverrides);
  const activeManifest = activeOverrides.get(key);

  if (activeManifest) {
    disabledOverrides.set(key, activeManifest);
    activeOverrides.delete(key);
  } else {
    const disabledManifest = disabledOverrides.get(key);
    if (!disabledManifest) return undefined;
    activeOverrides.set(key, disabledManifest);
    disabledOverrides.delete(key);
  }

  return { ...session, activeOverrides, disabledOverrides };
}

export function saveOverrideInSession(
  session: PopupSession,
  value: SaveOverrideValue,
): PopupSession {
  const key = artifactKey(value.production);
  const activeOverrides = new Map(session.activeOverrides);
  const disabledOverrides = new Map(session.disabledOverrides);
  disabledOverrides.delete(key);

  if (value.selected) activeOverrides.set(key, value.selected);
  else activeOverrides.delete(key);

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

export function clearOverrideInSession(
  session: PopupSession,
  key: string,
): PopupSession {
  const activeOverrides = new Map(session.activeOverrides);
  const disabledOverrides = new Map(session.disabledOverrides);
  activeOverrides.delete(key);
  disabledOverrides.delete(key);
  return { ...session, activeOverrides, disabledOverrides };
}

export function setOverrideScopeInSession(
  session: PopupSession,
  scope: Scope,
): PopupSession {
  return { ...session, scope };
}
