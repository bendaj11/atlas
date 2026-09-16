import type { ArtifactVersion } from './artifact-version';
import type { AtlasOverrideDocument } from './override-document';

interface AtlasRuntimeError {
  artifactId?: string;
  message: string;
}

export interface HostData {
  config: {
    schemaVersion: 'v1';
    hostId: string;
    environment: string;
    artifactRegistryUrl: string;
    environmentRegistryUrl?: string;
    developmentSessionUrl?: string;
  };
  pageUrl: string;
  catalog: {
    schemaVersion: '1';
    hostId: string;
    revision: string;
    environment?: string;
    host: ArtifactVersion;
    apps: ArtifactVersion[];
    widgetProviders?: ArtifactVersion[];
  };
  versions: Record<string, ArtifactVersion[]>;
  overrides: AtlasOverrideDocument | undefined;
  overrideScope: 'all' | 'tab' | undefined;
  visibleAppIds?: string[];
  runtimeErrors: AtlasRuntimeError[];
  versionErrors: string[];
}
