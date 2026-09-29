import type {
  AtlasHostManifest,
  AtlasManifest,
  AtlasManifestDescriptor,
} from '@atlas/schema';
import type { AtlasRetryPolicy } from '../../resilience/resilience.types.js';
import type { FetchBytes } from '../fetch-bytes.js';

export type PublishedManifest = AtlasManifest | AtlasHostManifest;

export type DeploymentManifestReference = AtlasManifestDescriptor & {
  url?: string;
};

export type ResolvedManifestReference = AtlasManifestDescriptor & {
  url: string;
};

export type LogError = (message: string, failure: unknown) => void;

export interface LoadHostDeploymentOptions {
  manifestUrl: string;
  /** Root used to resolve manifest references that carry only a relative path. */
  artifactRegistryUrl?: string;
  expectedHostId?: string;
  expectedEnvironment?: string;
  fetchBytes?: FetchBytes;
  requestPolicy?: AtlasRetryPolicy;
  logError?: LogError;
  /** Digest-keyed store of verified manifests; lets long-lived callers skip refetching unchanged artifacts. */
  manifestCache?: Map<string, PublishedManifest>;
}

export interface LoadPublishedManifestOptions {
  reference: ResolvedManifestReference;
  fetchBytes?: FetchBytes;
  manifestCache?: Map<string, PublishedManifest>;
  requestPolicy?: AtlasRetryPolicy;
}
