import type { ArtifactVersion } from './artifact-version';
import type { HostData } from './host-data';

export const SCOPES = ['all', 'tab'] as const;
export type Scope = (typeof SCOPES)[number];

export function isScope(value: unknown): value is Scope {
  return SCOPES.some((scope) => scope === value);
}

export interface ColumbusState {
  hostData: HostData;
  tabId: number;
  enabledArtifactVersionOverrides: Map<string, ArtifactVersion>;
  disabledArtifactVersionOverrides: Map<string, ArtifactVersion>;
  clearedLocalArtifactIds: Set<string>;
  scope: Scope;
}
