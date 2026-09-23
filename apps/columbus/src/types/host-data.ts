import type { AtlasHostCatalog, AtlasHostRuntimeConfig } from '@atlas/schema';
import type { ArtifactVersion } from './artifact-version';
import type { AtlasOverrideDocument } from './override-document';

export interface AtlasRuntimeError {
  artifactId?: string;
  message: string;
}

export interface HostPageState {
  visibleAppIds: string[];
  runtimeErrors: AtlasRuntimeError[];
}

export interface HostData extends HostPageState {
  config: AtlasHostRuntimeConfig;
  pageUrl: string;
  catalog: AtlasHostCatalog;
  versions: Record<string, ArtifactVersion[]>;
  overrides: AtlasOverrideDocument | undefined;
  overrideScope: 'all' | 'tab' | undefined;
  versionErrors: string[];
}
