import type { AtlasHostRuntimeConfig, AtlasManifest } from '@atlas/schema';
import {
  assertManifestAssetTrust,
  assertManifestStylesTrust,
  createRemoteTrustPolicy,
} from './trust-policy.js';
import type { AtlasRemoteTrustPolicy } from './trust-policy.types.js';

export class TrustPolicyDriver {
  private policy: AtlasRemoteTrustPolicy = {};
  private error: unknown;

  readonly given = {
    policy: (policy: AtlasRemoteTrustPolicy) => {
      this.policy = policy;

      return this;
    },
    runtimeConfig: (config: AtlasHostRuntimeConfig) => {
      this.policy = createRemoteTrustPolicy(config);

      return this;
    },
  };

  readonly when = {
    assetTrustAsserted: (manifest: AtlasManifest) => {
      try {
        assertManifestAssetTrust(manifest, this.policy);
      } catch (error) {
        this.error = error;
      }
    },
    stylesTrustAsserted: (manifest: AtlasManifest) => {
      try {
        assertManifestStylesTrust(manifest, this.policy);
      } catch (error) {
        this.error = error;
      }
    },
  };

  readonly get = {
    allowedOrigins: () => [...(this.policy.allowedOrigins ?? [])],
    error: () => this.error,
  };
}
