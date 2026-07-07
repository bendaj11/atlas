import type { AtlasExportedComponentManifest, AtlasManifest } from "@atlas/contracts";
import type { AtlasExportedComponentEntry, AtlasMfEntry } from "@atlas/sdk/lifecycle";
import { findManifestTrustErrors, verifyManifestIntegrity, type AtlasRemoteTrustPolicy } from "./runtime-discovery.js";
import { runResiliently, type AtlasRetryPolicy } from "../resilience.js";
import { mapWithConcurrency } from "../concurrency.js";

export interface AtlasFederationAdapter {
  initFederation(remotes: Record<string, string>): Promise<unknown>;
  loadRemoteModule<T = unknown>(remoteName: string, exposedModule: string): Promise<T>;
}

export interface AtlasNativeFederationImporters {
  initialize(manifests: AtlasManifest[]): Promise<void>;
  importRemote(manifest: AtlasManifest): Promise<AtlasMfEntry>;
  importComponent(component: AtlasExportedComponentManifest): Promise<AtlasExportedComponentEntry>;
}

export function createNativeFederationImporters(
  runtime: AtlasFederationAdapter,
  requestPolicy?: AtlasRetryPolicy
): AtlasNativeFederationImporters {
  const remoteNames = new Map<string, string>();
  const initializationErrors = new Map<string, Error>();

  return {
    async initialize(manifests) {
      await mapWithConcurrency(manifests, async (manifest) => {
        const remoteName = federationRemoteName(manifest.id);
        remoteNames.set(manifest.id, remoteName);
        try {
          await runResiliently(
            () => runtime.initFederation({ [remoteName]: manifest.remoteEntryUrl }).then(() => undefined),
            { stage: "federation-init", resource: manifest.remoteEntryUrl, mfId: manifest.id, version: manifest.version },
            requestPolicy
          );
        } catch (error) {
          initializationErrors.set(manifest.id, toError(error));
        }
      });
    },
    async importRemote(manifest) {
      const initializationError = initializationErrors.get(manifest.id);
      if (initializationError) throw initializationError;
      const entry = await runResiliently(
        () => runtime.loadRemoteModule<AtlasMfEntry>(requireInitializedRemoteName(remoteNames, manifest.id), manifest.exposes.entry),
        { stage: "remote-module", resource: manifest.remoteEntryUrl, mfId: manifest.id, version: manifest.version },
        requestPolicy
      );
      return normalizeMfEntry(entry, manifest.id);
    },
    async importComponent(component) {
      const initializationError = initializationErrors.get(component.ownerMfId);
      if (initializationError) throw initializationError;
      const entry = await runResiliently(
        () => runtime.loadRemoteModule<AtlasExportedComponentEntry>(requireInitializedRemoteName(remoteNames, component.ownerMfId), component.expose),
        { stage: "exported-component", resource: component.remoteEntryUrl, mfId: component.ownerMfId },
        requestPolicy
      );
      return normalizeComponentEntry(entry, `${component.ownerMfId}/${component.id}`);
    }
  };
}

/** Initializes only trusted remotes and reports rejected manifests through normal MF fallback UI. */
export async function createTrustedNativeFederationImporters(
  runtime: AtlasFederationAdapter,
  manifests: AtlasManifest[],
  policy: AtlasRemoteTrustPolicy,
  requestPolicy?: AtlasRetryPolicy
): Promise<AtlasNativeFederationImporters> {
  const trustErrors = await findManifestTrustErrors(manifests, policy, undefined, requestPolicy);
  const importers = createNativeFederationImporters(runtime, requestPolicy);
  await importers.initialize(manifests.filter((manifest) => !trustErrors.has(manifest.id)));
  return {
    initialize: importers.initialize,
    async importRemote(manifest) {
      const error = trustErrors.get(manifest.id);
      if (error) throw error;
      return importers.importRemote(manifest);
    },
    async importComponent(component) {
      const error = trustErrors.get(component.ownerMfId);
      if (error) throw error;
      return importers.importComponent(component);
    }
  };
}

export async function importNativeFederationRemote(
  manifest: AtlasManifest,
  policy: AtlasRemoteTrustPolicy = defaultManifestPolicy(manifest)
): Promise<AtlasMfEntry> {
  await verifyManifestIntegrity([manifest], undefined, policy);
  const remote = await import(/* @vite-ignore */ manifest.remoteEntryUrl);
  return normalizeMfEntry(remote, manifest.id);
}

function defaultManifestPolicy(manifest: AtlasManifest): AtlasRemoteTrustPolicy {
  const baseUrl = globalThis.location?.href ?? "http://atlas.local";
  return { allowedOrigins: [new URL(manifest.remoteEntryUrl, baseUrl).origin], requireIntegrity: true };
}

function normalizeMfEntry(value: AtlasMfEntry | { default?: AtlasMfEntry }, id: string): AtlasMfEntry {
  const candidate = value as { mount?: AtlasMfEntry["mount"]; default?: AtlasMfEntry };
  const entry = candidate.default ?? candidate;
  if (typeof entry.mount !== "function") throw new Error(`Atlas MF "${id}" does not expose a mount function.`);
  return entry as AtlasMfEntry;
}

function normalizeComponentEntry(
  value: AtlasExportedComponentEntry | { default?: AtlasExportedComponentEntry },
  ref: string
): AtlasExportedComponentEntry {
  const candidate = value as { mount?: AtlasExportedComponentEntry["mount"]; default?: AtlasExportedComponentEntry };
  const entry = candidate.default ?? candidate;
  if (typeof entry.mount !== "function") throw new Error(`Atlas exported component "${ref}" does not expose a mount function.`);
  return entry as AtlasExportedComponentEntry;
}

function federationRemoteName(id: string): string {
  return `atlas_${id.replace(/[^a-zA-Z0-9_]/g, "_")}`;
}

function requireInitializedRemoteName(remotes: Map<string, string>, mfId: string): string {
  const remoteName = remotes.get(mfId);
  if (!remoteName) throw new Error(`Native Federation was not initialized for Atlas MF "${mfId}".`);
  return remoteName;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
