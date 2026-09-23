import type { AtlasExportedWidgetManifest, AtlasManifest } from '@atlas/schema';
import type {
  AtlasAppEntry,
  AtlasExportedWidgetEntry,
} from '@atlas/sdk/lifecycle';
import { runResiliently } from '../resilience/resilience.js';
import type { AtlasRetryPolicy } from '../resilience/resilience.types.js';
import { mapWithConcurrency } from '../shared/concurrency.js';
import { convertToError } from '../shared/errors.js';
import {
  isMountableEntry,
  unwrapDefaultExport,
} from '../shared/module-entry.js';
import { isLoopbackUrl } from '../shared/url.js';
import { prepareAngularLocalRuntime } from './angular-local-runtime/angular-local-runtime.js';
import {
  AtlasAppMountExportMissingError,
  AtlasWidgetMountExportMissingError,
  AtlasWidgetOwnerMismatchError,
  AtlasWidgetOwnerUntrustedError,
} from './loader.errors.js';
import type {
  AtlasFederationAdapter,
  AtlasNativeFederationImporters,
  FederationRemote,
  NativeFederationImportersOptions,
  TrustedNativeFederationImportersOptions,
} from './native-federation.types.js';
import {
  createFetchBytesWithRetry,
  verifyManifestIntegrity,
} from './trust/manifest-integrity.js';
import { PERMISSIVE_TRUST_POLICY } from './trust/trust-policy.js';
import type { AtlasRemoteTrustPolicy } from './trust/trust-policy.types.js';

export function createNativeFederationImporters(
  options: NativeFederationImportersOptions,
): AtlasNativeFederationImporters;
/** @deprecated Pass `{ runtime, requestPolicy, hostRemoteEntryUrl }`. */
export function createNativeFederationImporters(
  runtime: AtlasFederationAdapter,
  requestPolicy?: AtlasRetryPolicy,
  hostRemoteEntryUrl?: string,
): AtlasNativeFederationImporters;
export function createNativeFederationImporters(
  optionsOrRuntime: NativeFederationImportersOptions | AtlasFederationAdapter,
  legacyRequestPolicy?: AtlasRetryPolicy,
  legacyHostRemoteEntryUrl?: string,
): AtlasNativeFederationImporters {
  const options: NativeFederationImportersOptions =
    'runtime' in optionsOrRuntime
      ? optionsOrRuntime
      : {
          runtime: optionsOrRuntime,
          ...(legacyRequestPolicy
            ? { requestPolicy: legacyRequestPolicy }
            : {}),
          ...(legacyHostRemoteEntryUrl
            ? { hostRemoteEntryUrl: legacyHostRemoteEntryUrl }
            : {}),
        };
  const { runtime, requestPolicy, hostRemoteEntryUrl } = options;
  const initializations = new Map<string, Promise<string>>();

  const initializeFederationRemote = (remote: FederationRemote) => {
    const existing = initializations.get(remote.id);

    if (existing) return existing;

    prepareAngularLocalRuntime(remote);

    const remoteName = createFederationRemoteName(remote.id);
    const initializing = runResiliently({
      operation: () =>
        runtime
          .initFederation(
            { [remoteName]: remote.remoteEntryUrl },
            hostRemoteEntryUrl
              ? { deployUrl: getArtifactDirectoryUrl(hostRemoteEntryUrl) }
              : undefined,
          )
          .then(() => remoteName),
      context: {
        stage: 'federation-init',
        resource: remote.remoteEntryUrl,
        appId: remote.id,
      },
      ...(requestPolicy ? { policy: requestPolicy } : {}),
    }).catch((error) => {
      initializations.delete(remote.id);

      throw convertToError(error);
    });

    initializations.set(remote.id, initializing);

    return initializing;
  };

  return {
    async initialize(manifests) {
      await mapWithConcurrency(manifests, async (manifest) => {
        try {
          await initializeFederationRemote(manifest);
        } catch {
          return;
        }
      });
    },
    async importRemote(manifest) {
      const remoteName = await initializeFederationRemote(manifest);
      const entry = await runResiliently({
        operation: () =>
          runtime.loadRemoteModule(remoteName, manifest.exposes.entry),
        context: {
          stage: 'remote-module',
          resource: manifest.remoteEntryUrl,
          appId: manifest.id,
          version: manifest.version,
        },
        ...(requestPolicy ? { policy: requestPolicy } : {}),
      });

      return requireAppEntryExport(entry, manifest.id);
    },
    async importWidget(widget, ownerManifest) {
      const remoteName = await initializeFederationRemote(
        ownerManifest ?? createFederationRemoteFromWidget(widget),
      );
      const entry = await runResiliently({
        operation: () => runtime.loadRemoteModule(remoteName, widget.expose),
        context: {
          stage: 'exported-widget',
          resource: widget.remoteEntryUrl,
          appId: widget.ownerAppId,
        },
        ...(requestPolicy ? { policy: requestPolicy } : {}),
      });

      return requireWidgetEntryExport(
        entry,
        `${widget.ownerAppId}/${widget.id}`,
      );
    },
  };
}

/** Initializes only trusted remotes and reports rejected manifests through normal app fallback UI. */
export function createTrustedNativeFederationImporters(
  options: TrustedNativeFederationImportersOptions,
): Promise<AtlasNativeFederationImporters>;
/** @deprecated Pass `{ runtime, manifests, policy, requestPolicy, hostRemoteEntryUrl }`. */
export function createTrustedNativeFederationImporters(
  runtime: AtlasFederationAdapter,
  manifests: AtlasManifest[],
  policy: AtlasRemoteTrustPolicy,
  requestPolicy?: AtlasRetryPolicy,
  hostRemoteEntryUrl?: string,
): Promise<AtlasNativeFederationImporters>;
export async function createTrustedNativeFederationImporters(
  optionsOrRuntime:
    TrustedNativeFederationImportersOptions | AtlasFederationAdapter,
  legacyManifests?: AtlasManifest[],
  legacyPolicy?: AtlasRemoteTrustPolicy,
  legacyRequestPolicy?: AtlasRetryPolicy,
  legacyHostRemoteEntryUrl?: string,
): Promise<AtlasNativeFederationImporters> {
  const options: TrustedNativeFederationImportersOptions =
    'runtime' in optionsOrRuntime
      ? optionsOrRuntime
      : {
          runtime: optionsOrRuntime,
          manifests: legacyManifests ?? [],
          policy: legacyPolicy ?? PERMISSIVE_TRUST_POLICY,
          ...(legacyRequestPolicy
            ? { requestPolicy: legacyRequestPolicy }
            : {}),
          ...(legacyHostRemoteEntryUrl
            ? { hostRemoteEntryUrl: legacyHostRemoteEntryUrl }
            : {}),
        };
  const { manifests, policy, requestPolicy } = options;
  const manifestsById = new Map(
    manifests.map((manifest) => [manifest.id, manifest]),
  );
  const trustChecks = new Map<string, Promise<void>>();
  const importers = createNativeFederationImporters(options);

  const ensureManifestIsTrusted = (manifest: AtlasManifest) => {
    const existing = trustChecks.get(manifest.id);

    if (existing) return existing;

    const checking = verifyManifestIntegrity([manifest], {
      fetchBytes: createFetchBytesWithRetry({
        manifest,
        ...(requestPolicy ? { requestPolicy } : {}),
      }),
      policy,
    }).catch((error) => {
      trustChecks.delete(manifest.id);

      throw error;
    });

    trustChecks.set(manifest.id, checking);

    return checking;
  };

  return {
    async initialize(selectedManifests) {
      const trusted: AtlasManifest[] = [];

      await mapWithConcurrency(selectedManifests, async (manifest) => {
        try {
          await ensureManifestIsTrusted(manifest);
          trusted.push(manifest);
        } catch {
          return;
        }
      });

      await importers.initialize(trusted);
    },
    async importRemote(manifest) {
      await ensureManifestIsTrusted(manifest);

      return importers.importRemote(manifest);
    },
    async importWidget(widget, ownerManifest) {
      const manifest = manifestsById.get(widget.ownerAppId) ?? ownerManifest;

      if (!manifest) {
        throw new AtlasWidgetOwnerUntrustedError({
          widgetId: widget.id,
          ownerAppId: widget.ownerAppId,
        });
      }

      if (manifest.id !== widget.ownerAppId) {
        throw new AtlasWidgetOwnerMismatchError({
          widgetId: widget.id,
          ownerAppId: widget.ownerAppId,
        });
      }

      await ensureManifestIsTrusted(manifest);

      return importers.importWidget(widget, manifest);
    },
  };
}

export async function importNativeFederationRemote(
  manifest: AtlasManifest,
  policy: AtlasRemoteTrustPolicy = PERMISSIVE_TRUST_POLICY,
): Promise<AtlasAppEntry> {
  await verifyManifestIntegrity([manifest], { policy });

  const remote = await import(/* @vite-ignore */ manifest.remoteEntryUrl);

  return requireAppEntryExport(remote, manifest.id);
}

function createFederationRemoteFromWidget(
  widget: AtlasExportedWidgetManifest,
): FederationRemote {
  return {
    id: widget.ownerAppId,
    remoteEntryUrl: widget.remoteEntryUrl,
    framework: widget.framework,
    channel: isLoopbackUrl(widget.remoteEntryUrl) ? 'local' : 'production',
  };
}

function getArtifactDirectoryUrl(remoteEntryUrl: string): string {
  return new URL('.', remoteEntryUrl).href;
}

function requireAppEntryExport(module: unknown, appId: string): AtlasAppEntry {
  const entry = unwrapDefaultExport(module);

  if (!isMountableEntry(entry))
    throw new AtlasAppMountExportMissingError(appId);

  return entry;
}

function requireWidgetEntryExport(
  module: unknown,
  widgetReference: string,
): AtlasExportedWidgetEntry {
  const entry = unwrapDefaultExport(module);

  if (!isMountableEntry(entry))
    throw new AtlasWidgetMountExportMissingError(widgetReference);

  return entry;
}

function createFederationRemoteName(appId: string): string {
  return `atlas_${appId.replace(/[^a-zA-Z0-9_]/g, '_')}`;
}
