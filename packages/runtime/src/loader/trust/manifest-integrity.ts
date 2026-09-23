import type { AtlasManifest } from '@atlas/schema';
import { runResiliently } from '../../resilience/resilience.js';
import type { AtlasRetryPolicy } from '../../resilience/resilience.types.js';
import { mapWithConcurrency } from '../../shared/concurrency.js';
import { convertToError } from '../../shared/errors.js';
import { fetchBytesFromNetwork, type FetchBytes } from '../fetch-bytes.js';
import { AtlasRemoteTrustError } from '../loader.errors.js';
import type {
  CreateFetchBytesWithRetryInput,
  FindManifestTrustErrorsOptions,
  VerifyManifestIntegrityOptions,
} from './manifest-integrity.types.js';
import {
  assertManifestAssetTrust,
  PERMISSIVE_TRUST_POLICY,
} from './trust-policy.js';
import type { AtlasRemoteTrustPolicy } from './trust-policy.types.js';

const networkIntegrityChecks = new Map<string, Promise<void>>();
const MAX_CACHED_INTEGRITY_CHECKS = 256;

export function verifyManifestIntegrity(
  manifests: AtlasManifest[],
  options?: VerifyManifestIntegrityOptions,
): Promise<void>;
/** @deprecated Pass `{ fetchBytes, policy }` as the second argument. */
export function verifyManifestIntegrity(
  manifests: AtlasManifest[],
  fetchBytes: FetchBytes | undefined,
  policy?: AtlasRemoteTrustPolicy,
): Promise<void>;
export async function verifyManifestIntegrity(
  manifests: AtlasManifest[],
  optionsOrFetchBytes: VerifyManifestIntegrityOptions | FetchBytes = {},
  legacyPolicy?: AtlasRemoteTrustPolicy,
): Promise<void> {
  const options: VerifyManifestIntegrityOptions =
    typeof optionsOrFetchBytes === 'function'
      ? {
          fetchBytes: optionsOrFetchBytes,
          ...(legacyPolicy ? { policy: legacyPolicy } : {}),
        }
      : legacyPolicy
        ? { ...optionsOrFetchBytes, policy: legacyPolicy }
        : optionsOrFetchBytes;
  const fetchBytes = options.fetchBytes ?? fetchBytesFromNetwork;
  const policy = options.policy ?? PERMISSIVE_TRUST_POLICY;

  for (const manifest of manifests) {
    assertManifestAssetTrust(manifest, policy);

    if (!manifest.integrity) continue;

    if (fetchBytes !== fetchBytesFromNetwork) {
      await verifyRemoteEntryIntegrity(manifest, fetchBytes);

      continue;
    }

    await verifyRemoteEntryIntegrityOnce(manifest, fetchBytes);
  }
}

function verifyRemoteEntryIntegrityOnce(
  manifest: AtlasManifest,
  fetchBytes: FetchBytes,
): Promise<void> {
  const key = `${manifest.remoteEntryUrl}\0${manifest.integrity}`;
  const existing = networkIntegrityChecks.get(key);

  if (existing) return existing;

  const checking = verifyRemoteEntryIntegrity(manifest, fetchBytes).catch(
    (error) => {
      networkIntegrityChecks.delete(key);

      throw error;
    },
  );

  networkIntegrityChecks.set(key, checking);

  if (networkIntegrityChecks.size > MAX_CACHED_INTEGRITY_CHECKS) {
    networkIntegrityChecks.delete(networkIntegrityChecks.keys().next().value!);
  }

  return checking;
}

async function verifyRemoteEntryIntegrity(
  manifest: AtlasManifest,
  fetchBytes: FetchBytes,
): Promise<void> {
  const [algorithm, expected] = manifest.integrity!.split('-', 2);

  if (algorithm !== 'sha256' || !expected) {
    throw new AtlasRemoteTrustError(
      `Atlas app "${manifest.id}" has an unsupported integrity value; Atlas requires sha256-<base64>.`,
    );
  }

  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    await fetchBytes(manifest.remoteEntryUrl),
  );

  if (convertBytesToBase64(new Uint8Array(digest)) !== expected) {
    throw new AtlasRemoteTrustError(
      `Atlas rejected app "${manifest.id}" because its remote entry bytes do not match the manifest SHA-256 integrity value.`,
    );
  }
}

/** Verifies manifests independently so one rejected remote cannot prevent the host from starting. */
export function findManifestTrustErrors(
  options: FindManifestTrustErrorsOptions,
): Promise<ReadonlyMap<string, Error>>;
/** @deprecated Pass `{ manifests, policy, fetchBytes, requestPolicy }`. */
export function findManifestTrustErrors(
  manifests: AtlasManifest[],
  policy: AtlasRemoteTrustPolicy,
  fetchBytes?: FetchBytes,
  requestPolicy?: AtlasRetryPolicy,
): Promise<ReadonlyMap<string, Error>>;
export async function findManifestTrustErrors(
  optionsOrManifests: FindManifestTrustErrorsOptions | AtlasManifest[],
  legacyPolicy?: AtlasRemoteTrustPolicy,
  legacyFetchBytes?: FetchBytes,
  legacyRequestPolicy?: AtlasRetryPolicy,
): Promise<ReadonlyMap<string, Error>> {
  const options: FindManifestTrustErrorsOptions = Array.isArray(
    optionsOrManifests,
  )
    ? {
        manifests: optionsOrManifests,
        policy: legacyPolicy ?? PERMISSIVE_TRUST_POLICY,
        ...(legacyFetchBytes ? { fetchBytes: legacyFetchBytes } : {}),
        ...(legacyRequestPolicy ? { requestPolicy: legacyRequestPolicy } : {}),
      }
    : optionsOrManifests;
  const errors = new Map<string, Error>();

  await mapWithConcurrency(options.manifests, async (manifest) => {
    try {
      await verifyManifestIntegrity([manifest], {
        fetchBytes: createFetchBytesWithRetry({
          manifest,
          ...(options.fetchBytes ? { fetchBytes: options.fetchBytes } : {}),
          ...(options.requestPolicy
            ? { requestPolicy: options.requestPolicy }
            : {}),
        }),
        policy: options.policy,
      });
    } catch (error) {
      errors.set(manifest.id, convertToError(error));
    }
  });

  return errors;
}

export function createFetchBytesWithRetry(
  input: CreateFetchBytesWithRetryInput,
): FetchBytes {
  const fetchBytes = input.fetchBytes ?? fetchBytesFromNetwork;

  return (url) =>
    runResiliently({
      operation: (signal) => fetchBytes(url, signal),
      context: {
        stage: 'integrity',
        resource: url,
        appId: input.manifest.id,
        version: input.manifest.version,
      },
      ...(input.requestPolicy ? { policy: input.requestPolicy } : {}),
    });
}

function convertBytesToBase64(bytes: Uint8Array): string {
  let binary = '';

  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary);
}
