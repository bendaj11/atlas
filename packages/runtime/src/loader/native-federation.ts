import type { AtlasExportedWidgetManifest, AtlasManifest } from "@atlas/schema";
import type { AtlasExportedWidgetEntry, AtlasAppEntry } from "@atlas/sdk/lifecycle";
import { verifyManifestIntegrity, type AtlasRemoteTrustPolicy } from "./runtime-discovery.js";
import { runResiliently, type AtlasRetryPolicy } from "../resilience.js";
import { mapWithConcurrency } from "../concurrency.js";
import { runtimeError } from "../runtime-error.js";

export interface AtlasFederationAdapter {
  initFederation(remotes: Record<string, string>, options?: { deployUrl?: string }): Promise<unknown>;
  loadRemoteModule(remoteName: string, exposedModule: string): Promise<unknown>;
}

export interface AtlasNativeFederationImporters {
  initialize(manifests: AtlasManifest[]): Promise<void>;
  importRemote(manifest: AtlasManifest): Promise<AtlasAppEntry>;
  importWidget(
    widget: AtlasExportedWidgetManifest,
    ownerManifest?: AtlasManifest
  ): Promise<AtlasExportedWidgetEntry>;
}

export function createNativeFederationImporters(
  runtime: AtlasFederationAdapter,
  requestPolicy?: AtlasRetryPolicy,
  hostRemoteEntryUrl?: string
): AtlasNativeFederationImporters {
  const remoteNames = new Map<string, string>();
  const initializationErrors = new Map<string, Error>();
  const initializationTasks = new Map<string, Promise<void>>();

  const initializeRemote = (remote: FederationRemote): Promise<void> => {
    const existing = initializationTasks.get(remote.id);
    if (existing) return existing;
    const remoteName = federationRemoteName(remote.id);
    remoteNames.set(remote.id, remoteName);
    const task = runResiliently(
      () => runtime.initFederation(
        { [remoteName]: remote.remoteEntryUrl },
        federationOptions(hostRemoteEntryUrl)
      ).then(() => undefined),
      { stage: "federation-init", resource: remote.remoteEntryUrl, appId: remote.id },
      requestPolicy
    ).catch((error) => {
      const normalized = toError(error);
      initializationErrors.set(remote.id, normalized);
      throw normalized;
    });
    initializationTasks.set(remote.id, task);
    return task;
  };

  return {
    async initialize(manifests) {
      await mapWithConcurrency(manifests, async (manifest) => {
        try { await initializeRemote(manifest); }
        catch { return; }
      });
    },
    async importRemote(manifest) {
      if (!remoteNames.has(manifest.id)) await initializeRemote(manifest);
      const initializationError = initializationErrors.get(manifest.id);
      if (initializationError) throw initializationError;
      const entry = await runResiliently(
        () => runtime.loadRemoteModule(requireInitializedRemoteName(remoteNames, manifest.id), manifest.exposes.entry),
        { stage: "remote-module", resource: manifest.remoteEntryUrl, appId: manifest.id, version: manifest.version },
        requestPolicy
      );
      return normalizeAppEntry(entry, manifest.id);
    },
    async importWidget(widget, ownerManifest) {
      const remote = ownerManifest ?? remoteFromWidget(widget);
      if (!remoteNames.has(widget.ownerAppId)) await initializeRemote(remote);
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

type FederationRemote = Pick<AtlasManifest, "id" | "remoteEntryUrl">;

function federationOptions(hostRemoteEntryUrl?: string): { deployUrl: string } | undefined {
  return hostRemoteEntryUrl ? { deployUrl: artifactDirectoryUrl(hostRemoteEntryUrl) } : undefined;
}

function remoteFromWidget(widget: AtlasExportedWidgetManifest): FederationRemote {
  return {
    id: widget.ownerAppId,
    remoteEntryUrl: widget.remoteEntryUrl
  };
}

/** Initializes only trusted remotes and reports rejected manifests through normal app fallback UI. */
export async function createTrustedNativeFederationImporters(
  runtime: AtlasFederationAdapter,
  manifests: AtlasManifest[],
  policy: AtlasRemoteTrustPolicy,
  requestPolicy?: AtlasRetryPolicy,
  hostRemoteEntryUrl?: string
): Promise<AtlasNativeFederationImporters> {
  const manifestsById = new Map(manifests.map((manifest) => [manifest.id, manifest]));
  const trustTasks = new Map<string, Promise<void>>();
  const importers = createNativeFederationImporters(runtime, requestPolicy, hostRemoteEntryUrl);
  const ensureTrusted = (manifest: AtlasManifest): Promise<void> => {
    const existing = trustTasks.get(manifest.id);
    if (existing) return existing;
    const checking = verifyManifestIntegrity([manifest], (url) => runResiliently(
      (signal) => fetchRemoteBytes(url, signal),
      { stage: "integrity", resource: url, appId: manifest.id, version: manifest.version },
      requestPolicy
    ), policy);
    trustTasks.set(manifest.id, checking);
    return checking;
  };
  return {
    async initialize(selectedManifests) {
      const trusted: AtlasManifest[] = [];
      await mapWithConcurrency(selectedManifests, async (manifest) => {
        try {
          await ensureTrusted(manifest);
          trusted.push(manifest);
        } catch {
          return;
        }
      });
      await importers.initialize(trusted);
    },
    async importRemote(manifest) {
      await ensureTrusted(manifest);
      return importers.importRemote(manifest);
    },
    async importWidget(widget, ownerManifest) {
      const manifest = manifestsById.get(widget.ownerAppId) ?? ownerManifest;
      if (!manifest) {
        throw runtimeError(`Atlas cannot load widget "${widget.id}" because owner app "${widget.ownerAppId}" is not trusted by this host.`, {
          suggestedActions: "Add the owner app manifest to the selected host catalog, then republish the catalog and reload.",
          code: "ATLAS_WIDGET_OWNER_UNTRUSTED"
        });
      }
      if (manifest.id !== widget.ownerAppId) {
        throw runtimeError(`Atlas cannot load widget "${widget.id}" because its owner manifest does not match app "${widget.ownerAppId}".`, {
          suggestedActions: "Correct the widget ownerAppId or registry manifest, then republish the owning app.",
          code: "ATLAS_WIDGET_OWNER_MISMATCH"
        });
      }
      await ensureTrusted(manifest);
      return importers.importWidget(widget, manifest);
    }
  };
}

async function fetchRemoteBytes(url: string, signal: AbortSignal): Promise<ArrayBuffer> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw runtimeError(`Atlas could not download remote entry "${url}": HTTP ${response.status}.`, {
      suggestedActions: "Deploy the remote entry at the manifest URL and verify the host can fetch it through CORS, then retry.",
      code: "ATLAS_REMOTE_ENTRY_HTTP_ERROR"
    });
  }
  return response.arrayBuffer();
}

function artifactDirectoryUrl(remoteEntryUrl: string): string {
  return new URL(".", remoteEntryUrl).href;
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
  if (!hasMountFunction(entry)) {
    throw runtimeError(`Atlas cannot mount app "${id}" because its remote module does not export mount(request).`, {
      suggestedActions: "Export the Atlas app lifecycle entry from the configured federation expose, rebuild the app, and republish it.",
      code: "ATLAS_APP_MOUNT_EXPORT_MISSING"
    });
  }
  return entry;
}

function normalizeWidgetEntry(value: unknown, ref: string): AtlasExportedWidgetEntry {
  const entry = unwrapDefault(value);
  if (!hasMountFunction(entry)) {
    throw runtimeError(`Atlas cannot mount exported widget "${ref}" because its remote module does not export mount(request).`, {
      suggestedActions: "Regenerate or correct the widget federation expose, rebuild its owner app, and republish it.",
      code: "ATLAS_WIDGET_MOUNT_EXPORT_MISSING"
    });
  }
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
  if (!remoteName) {
    throw runtimeError(`Atlas cannot load app "${appId}" because Native Federation was not initialized for it.`, {
      suggestedActions: "Verify the app manifest remoteEntryUrl and federation initialization failure, then retry loading the app.",
      code: "ATLAS_FEDERATION_NOT_INITIALIZED"
    });
  }
  return remoteName;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
