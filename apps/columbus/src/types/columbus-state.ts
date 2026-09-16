import type { ArtifactVersion } from './artifact-version';
import type { HostData } from './host-data';

export type Scope = 'all' | 'tab';

export interface ColumbusState {
  hostData: HostData;
  tabId: number;
  enabledArtifactVersionOverrides: Map<string, ArtifactVersion>;
  disabledArtifactVersionOverrides: Map<string, ArtifactVersion>;
  clearedLocalArtifactIds: Set<string>;
  scope: Scope;
}
