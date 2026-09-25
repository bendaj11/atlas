import type {
  AtlasDevelopmentOfferIds,
  AtlasDevelopmentOffers,
  AtlasHostCatalog,
  AtlasHostRuntimeConfig,
} from '@atlas/schema';
import type { ArtifactVersion } from './artifact-version';
import type {
  AtlasArtifactOverride,
  AtlasOverrideDocument,
} from './override-document';

export type DevelopmentOffers = AtlasDevelopmentOffers<
  AtlasArtifactOverride,
  ArtifactVersion
>;

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
  developmentOffers: DevelopmentOffers | undefined;
  dismissedOfferIds: AtlasDevelopmentOfferIds;
  versionErrors: string[];
}
