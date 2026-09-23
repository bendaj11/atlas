import type { AtlasManifest } from '@atlas/schema';
import type { AtlasRetryPolicy } from '../../resilience/resilience.types.js';
import type { FetchBytes } from '../fetch-bytes.js';
import type { AtlasRemoteTrustPolicy } from './trust-policy.types.js';

export interface VerifyManifestIntegrityOptions {
  fetchBytes?: FetchBytes;
  policy?: AtlasRemoteTrustPolicy;
}

export interface FindManifestTrustErrorsOptions {
  manifests: AtlasManifest[];
  policy: AtlasRemoteTrustPolicy;
  fetchBytes?: FetchBytes;
  requestPolicy?: AtlasRetryPolicy;
}

export interface CreateFetchBytesWithRetryInput {
  manifest: AtlasManifest;
  fetchBytes?: FetchBytes;
  requestPolicy?: AtlasRetryPolicy;
}
