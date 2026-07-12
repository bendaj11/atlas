import type { AtlasExportedWidgetManifest, AtlasManifest } from "@atlas/schema";
import type { AtlasExportedWidgetEntry, AtlasAppEntry } from "@atlas/sdk/lifecycle";
import { findManifestTrustErrors, verifyManifestIntegrity, type AtlasRemoteTrustPolicy } from "./runtime-discovery.js";
import { runResiliently, type AtlasRetryPolicy } from "../resilience.js";
import { mapWithConcurrency } from "../concurrency.js";

export interface AtlasFederationAdapter {
  initFederation(remotes: Record<string, string>): Promise<unknown>;
  loadRemoteModule(remoteName: string, exposedModule: string): Promise<unknown>;
}

export interface AtlasNativeFederationImporters {
  initialize(manifests: AtlasManifest[]): Promise<void>;
  importRemote(manifest: AtlasManifest): Promise<AtlasAppEntry>;
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
      await mapWithConcurrency(manifests, async (manifest) => {
        const remoteName = federationRemoteName(manifest.id);
        remoteNames.set(manifest.id, remoteName);
        try {
          await runResiliently(
            () => runtime.initFederation({ [remoteName]: manifest.remoteEntryUrl }).then(() => undefined),
            { stage: "federation-init", resource: manifest.remoteEntryUrl, appId: manifest.id, version: manifest.version },
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
        () => runtime.loadRemoteModule(requireInitializedRemoteName(remoteNames, manifest.id), manifest.exposes.entry),
        { stage: "remote-module", resource: manifest.remoteEntryUrl, appId: manifest.id, version: manifest.version },
        requestPolicy
      );
      return normalizeAppEntry(entry, manifest.id);
    },
    async importWidget(widget) {
      const initializationError = initializationErrors.get(widget.ownerAppId);
      if (initializationError) throw initializationError;
      const entry = await runResiliently(
        () => runtime.loadRemoteModule(requireInitializedRemoteName(remoteNames, widget.ownerAppId), widget.expose),
        { stage: "exported-widget", resource: widget.remoteEntryUrl, appId: widget.ownerAppId },
        requestPolicy
      );
      return normalizeWidgetEntry(entry, `${widget.ownerAppId}/${widget.id}`);
    }
  };
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
      const error = trustErrors.get(widget.ownerAppId);
      if (error) throw error;
      return importers.importWidget(widget);
    }
  };
}

export async function importNativeFederationRemote(
  manifest: AtlasManifest,
  policy: AtlasRemoteTrustPolicy = defaultManifestPolicy(manifest)
): Promise<AtlasAppEntry> {
  await verifyManifestIntegrity([manifest], undefined, policy);
  const remote = await import(/* @vite-ignore */ manifest.remoteEntryUrl);
  return normalizeAppEntry(remote, manifest.id);
}

function defaultManifestPolicy(manifest: AtlasManifest): AtlasRemoteTrustPolicy {
  const baseUrl = globalThis.location?.href ?? "http://atlas.local";
  new URL(manifest.remoteEntryUrl, baseUrl);
  return {};
}

function normalizeAppEntry(value: unknown, id: string): AtlasAppEntry {
  const entry = unwrapDefault(value);
  if (!hasMountFunction(entry)) throw new Error(`Atlas app "${id}" does not expose a mount function.`);
  return entry;
}

function normalizeWidgetEntry(value: unknown, ref: string): AtlasExportedWidgetEntry {
  const entry = unwrapDefault(value);
  if (!hasMountFunction(entry)) throw new Error(`Atlas exported widget "${ref}" does not expose a mount function.`);
  return entry;
}

function unwrapDefault(value: unknown): unknown {
  if (typeof value !== "object" || value === null || !("default" in value)) return value;
  return value.default ?? value;
}

function hasMountFunction(value: unknown): value is AtlasAppEntry & AtlasExportedWidgetEntry {
  return typeof value === "object" && value !== null && "mount" in value && typeof value.mount === "function";
}

function federationRemoteName(id: string): string {
  return `atlas_${id.replace(/[^a-zA-Z0-9_]/g, "_")}`;
}

function requireInitializedRemoteName(remotes: Map<string, string>, appId: string): string {
  const remoteName = remotes.get(appId);
  if (!remoteName) throw new Error(`Native Federation was not initialized for Atlas app "${appId}".`);
  return remoteName;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
