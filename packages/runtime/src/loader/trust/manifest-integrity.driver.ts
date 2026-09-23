import { jest } from '@jest/globals';
import type { AtlasManifest } from '@atlas/schema';
import { encodeTextAsBytes } from '../../shared/bytes.testkit.js';
import type { FetchBytes } from '../fetch-bytes.js';
import {
  findManifestTrustErrors,
  verifyManifestIntegrity,
} from './manifest-integrity.js';
import type { AtlasRemoteTrustPolicy } from './trust-policy.types.js';

export class ManifestIntegrityDriver {
  private readonly fetchBytes = jest.fn<FetchBytes>(
    async () => new ArrayBuffer(0),
  );
  private policy: AtlasRemoteTrustPolicy = {};
  private error: unknown;
  private trustErrors: ReadonlyMap<string, Error> | undefined;

  readonly given = {
    remoteBytes: (text: string) => {
      this.fetchBytes.mockResolvedValue(encodeTextAsBytes(text));

      return this;
    },
    remoteBytesFailing: (error: Error) => {
      this.fetchBytes.mockRejectedValue(error);

      return this;
    },
    policy: (policy: AtlasRemoteTrustPolicy) => {
      this.policy = policy;

      return this;
    },
  };

  readonly when = {
    verified: async (manifests: AtlasManifest[]) => {
      try {
        await verifyManifestIntegrity(manifests, {
          fetchBytes: this.fetchBytes,
          policy: this.policy,
        });
      } catch (error) {
        this.error = error;
      }
    },
    verifiedWithLegacyArguments: async (manifests: AtlasManifest[]) => {
      try {
        await verifyManifestIntegrity(manifests, this.fetchBytes, this.policy);
      } catch (error) {
        this.error = error;
      }
    },
    trustErrorsCollected: async (manifests: AtlasManifest[]) => {
      this.trustErrors = await findManifestTrustErrors({
        manifests,
        policy: this.policy,
        fetchBytes: this.fetchBytes,
        requestPolicy: { retryCount: 0, timeoutMs: 1_000 },
      });
    },
  };

  readonly get = {
    error: () => this.error,
    trustErrors: () => this.trustErrors!,
    fetchBytesMock: () => this.fetchBytes,
  };
}
