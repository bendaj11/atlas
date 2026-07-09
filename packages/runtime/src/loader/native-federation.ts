import type { AtlasExportedWidgetManifest, AtlasManifest } from "@atlas/schema";
import type { AtlasExportedWidgetEntry, AtlasMfEntry } from "@atlas/sdk/lifecycle";
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
  importWidget(widget: AtlasExportedWidgetManifest): Promise<AtlasExportedWidgetEntry>;
}

export function createNativeFederationImporters(
  runtime: AtlasFederationAdapter,
  requestPolicy?: AtlasRetryPolicy
): AtlasNativeFederationImporters {
  const remoteNames = new Map<string, string>();
  const initializationErrors = new Map<string, Error>();

  return {
    async initialize(manifests) {
      for (const manifest of manifests) {
        const remoteName = federationRemoteName(manifest.id);
        remoteNames.set(manifest.id, remoteName);
      }

      try {
        await runResiliently(
          () => runtime.initFederation(remoteEntries(manifests)).then(() => undefined),
          { stage: "federation-init" },
          requestPolicy
        );
      } catch {
        await mapWithConcurrency(manifests, async (manifest) => {
          const remoteName = requireInitializedRemoteName(remoteNames, manifest.id);
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
      }
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
    async importWidget(widget) {
      const initializationError = initializationErrors.get(widget.ownerMfId);
      if (initializationError) throw initializationError;
      const entry = await runResiliently(
        () => runtime.loadRemoteModule<AtlasExportedWidgetEntry>(requireInitializedRemoteName(remoteNames, widget.ownerMfId), widget.expose),
        { stage: "exported-widget", resource: widget.remoteEntryUrl, mfId: widget.ownerMfId },
        requestPolicy
      );
      return normalizeWidgetEntry(entry, `${widget.ownerMfId}/${widget.id}`);
    }
  };
}

function remoteEntries(manifests: readonly AtlasManifest[]): Record<string, string> {
  const remotes: Record<string, string> = {};
  for (const manifest of manifests) {
    remotes[federationRemoteName(manifest.id)] = manifest.remoteEntryUrl;
  }
  return remotes;
}

/** Initializes only trusted remotes and reports rejected manifests through normal app fallback UI. */
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
    async importWidget(widget) {
      const error = trustErrors.get(widget.ownerMfId);
      if (error) throw error;
      return importers.importWidget(widget);
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
  new URL(manifest.remoteEntryUrl, baseUrl);
  return {};
}

function normalizeMfEntry(value: AtlasMfEntry | { default?: AtlasMfEntry }, id: string): AtlasMfEntry {
  const candidate = value as { mount?: AtlasMfEntry["mount"]; default?: AtlasMfEntry };
  const entry = candidate.default ?? candidate;
  if (typeof entry.mount !== "function") throw new Error(`Atlas app "${id}" does not expose a mount function.`);
  return entry as AtlasMfEntry;
}

function normalizeWidgetEntry(
  value: AtlasExportedWidgetEntry | { default?: AtlasExportedWidgetEntry },
  ref: string
): AtlasExportedWidgetEntry {
  const candidate = value as { mount?: AtlasExportedWidgetEntry["mount"]; default?: AtlasExportedWidgetEntry };
  const entry = candidate.default ?? candidate;
  if (typeof entry.mount !== "function") throw new Error(`Atlas exported widget "${ref}" does not expose a mount function.`);
  return entry as AtlasExportedWidgetEntry;
}

function federationRemoteName(id: string): string {
  return `atlas_${id.replace(/[^a-zA-Z0-9_]/g, "_")}`;
}

function requireInitializedRemoteName(remotes: Map<string, string>, mfId: string): string {
  const remoteName = remotes.get(mfId);
  if (!remoteName) throw new Error(`Native Federation was not initialized for Atlas app "${mfId}".`);
  return remoteName;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
