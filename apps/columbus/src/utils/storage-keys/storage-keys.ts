import type { Scope } from '../../types/columbus-state';

export const OVERRIDE_DOCUMENT_KEY = 'atlas.runtime-overrides';
export const HOST_DATA_CACHE_KEY = 'atlas.host-data-cache';

export function persistedOverridesKey(hostId: string): string {
  return `atlas.overrides.${hostId}`;
}

export function disabledLocalAppsKey(hostId: string): string {
  return `atlas.disabled-local-apps.${hostId}`;
}

export function disabledOverridesKey(
  hostId: string,
  tabId: number,
  scope: Scope,
): string {
  return scopedKey('atlas.disabled-overrides', hostId, tabId, scope);
}

export function suppressedArtifactsKey(
  hostId: string,
  tabId: number,
  scope: Scope,
): string {
  return scopedKey('atlas.suppressed-artifacts', hostId, tabId, scope);
}

function scopedKey(
  prefix: string,
  hostId: string,
  tabId: number,
  scope: Scope,
): string {
  return scope === 'tab'
    ? `${prefix}.${hostId}.tab.${tabId}`
    : `${prefix}.${hostId}.all`;
}
