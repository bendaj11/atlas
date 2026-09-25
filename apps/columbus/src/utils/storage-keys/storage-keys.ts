import type { Scope } from '../../types/columbus-state';

export const OVERRIDE_DOCUMENT_KEY = 'atlas.runtime-overrides';

export function hostDataCacheKey(tabId: number): string {
  return `atlas.host-data-cache.${tabId}`;
}

export function persistedOverridesKey(hostId: string): string {
  return `atlas.overrides.${hostId}`;
}

export function disabledOverridesKey(
  hostId: string,
  tabId: number,
  scope: Scope,
): string {
  return scopedKey('atlas.disabled-overrides', hostId, tabId, scope);
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
