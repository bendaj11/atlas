import type { AtlasHostCatalog, AtlasHostRuntimeConfig } from '@atlas/schema';
import type { ArtifactVersion } from './artifact-version';
import type { AtlasOverrideDocument } from './override-document';

export interface AtlasRuntimeError {
  artifactId?: string;
  message: string;
}

export interface HostData {
  config: AtlasHostRuntimeConfig;
  pageUrl: string;
  catalog: AtlasHostCatalog;
  versions: Record<string, ArtifactVersion[]>;
  overrides: AtlasOverrideDocument | undefined;
  overrideScope: 'all' | 'tab' | undefined;
  visibleAppIds?: string[];
  runtimeErrors: AtlasRuntimeError[];
  versionErrors: string[];
}
