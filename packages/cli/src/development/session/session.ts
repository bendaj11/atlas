import type { AtlasRuntimeOverride } from '@atlas/runtime';
import type { AtlasHostCatalog, AtlasHostManifest } from '@atlas/schema';
import type { AtlasDevOverrideDocument, DevSessionStore } from '../types.js';
import {
  createDevSession,
  createLocalDevCatalog,
  mergeLocalCatalog,
} from './dev-catalog.js';

interface DevSessionEntry {
  override: AtlasRuntimeOverride;
  ready: boolean;
}

interface HostDevSession {
  entries: Map<string, DevSessionEntry>;
  generatedAt: string;
  hostOverride?: AtlasHostManifest;
  hostReady: boolean;
  previewUrls: Set<string>;
}

export function createDevSessionStore(
  initial: AtlasDevOverrideDocument,
  overrideUrl: string,
): DevSessionStore {
  const hosts = new Map<string, HostDevSession>();

  const register = (document: AtlasDevOverrideDocument): void => {
    const host =
      hosts.get(document.hostId) ?? createHostDevSession(document.generatedAt);
    host.generatedAt = document.generatedAt;

    if (document.hostOverride) {
      host.hostOverride = document.hostOverride;
      host.hostReady = false;
    }

    for (const override of document.overrides) {
      const existing = host.entries.get(override.manifest.id);
      host.entries.set(override.manifest.id, {
        override,
        ready: existing?.ready ?? false,
      });
    }

    if (document.previewUrl)
      host.previewUrls.add(normalizePreviewUrl(document.previewUrl));

    hosts.set(document.hostId, host);
  };

  const currentDocument = (
    requestedHostId?: string,
  ): AtlasDevOverrideDocument | undefined => {
    const hostId = resolveHostId({ hosts, requestedHostId });
    const host = hostId ? hosts.get(hostId) : undefined;

    if (!hostId || !host) return undefined;

    const overrides = [...host.entries.values()]
      .filter((entry) => entry.ready)
      .map((entry) => entry.override);
    const hostOverride = host.hostReady ? host.hostOverride : undefined;

    if (overrides.length === 0 && !hostOverride) return undefined;

    return {
      schemaVersion: '1',
      hostId,
      overrides,
      generatedAt: host.generatedAt,
      ...(hostOverride ? { hostOverride } : {}),
    };
  };

  const localCatalog = (
    hostId: string | undefined,
    publishedCatalog: AtlasHostCatalog | undefined,
  ):
    | { document: AtlasDevOverrideDocument; catalog: AtlasHostCatalog }
    | undefined => {
    const document = currentDocument(hostId);

    if (!document) return undefined;

    const local = createLocalDevCatalog(document);
    const catalog = publishedCatalog
      ? mergeLocalCatalog({
          productionCatalog: publishedCatalog,
          localCatalog: local,
        })
      : local;

    return { document, catalog };
  };

  const markReady = (appId: string, requestedHostId?: string): void => {
    for (const host of matchingHosts({ hosts, appId, requestedHostId })) {
      const entry = host.entries.get(appId);

      if (entry) entry.ready = true;
    }
  };

  register(initial);

  return {
    register,
    unregister(appId, requestedHostId) {
      for (const [hostId, host] of hosts) {
        if (requestedHostId && requestedHostId !== hostId) continue;

        host.entries.delete(appId);

        if (host.entries.size === 0 && !host.hostOverride) hosts.delete(hostId);
      }
    },
    unregisterHost(hostId) {
      const host = hosts.get(hostId);

      if (!host) return;

      delete host.hostOverride;
      host.hostReady = false;

      if (host.entries.size === 0) hosts.delete(hostId);
    },
    markReady,
    markHostReady(hostId) {
      const host = hosts.get(hostId);

      if (host?.hostOverride) host.hostReady = true;
    },
    markDocumentReady(document) {
      if (document.hostOverride) {
        const host = hosts.get(document.hostId);

        if (host) host.hostReady = true;
      }

      for (const override of document.overrides)
        markReady(override.appId, document.hostId);
    },
    document: currentDocument,
    catalog(hostId, productionCatalog) {
      return localCatalog(hostId, productionCatalog)?.catalog;
    },
    devSession(hostId, publishedCatalog) {
      const resolved = localCatalog(hostId, publishedCatalog);

      return resolved
        ? createDevSession(resolved.document, resolved.catalog, overrideUrl)
        : undefined;
    },
    hasReadySession() {
      return [...hosts.keys()].some(
        (hostId) => currentDocument(hostId) !== undefined,
      );
    },
    previewAllowed(hostId, previewUrl) {
      const resolvedHostId = resolveHostId({ hosts, requestedHostId: hostId });

      if (!resolvedHostId) return false;

      try {
        const normalized = normalizePreviewUrl(previewUrl);

        return hosts.get(resolvedHostId)?.previewUrls.has(normalized) ?? false;
      } catch {
        return false;
      }
    },
  };
}

function createHostDevSession(generatedAt: string): HostDevSession {
  return {
    entries: new Map<string, DevSessionEntry>(),
    generatedAt,
    hostReady: false,
    previewUrls: new Set<string>(),
  };
}

function matchingHosts({
  hosts,
  appId,
  requestedHostId,
}: {
  hosts: Map<string, HostDevSession>;
  appId: string;
  requestedHostId?: string;
}): HostDevSession[] {
  if (requestedHostId) {
    const host = hosts.get(requestedHostId);

    return host ? [host] : [];
  }

  return [...hosts.values()].filter((host) => host.entries.has(appId));
}

function normalizePreviewUrl(value: string): string {
  const url = new URL(value);

  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    throw new Error('Atlas preview URL must use HTTP or HTTPS.');

  url.searchParams.delete('atlas-dev-port');

  return url.href;
}

function resolveHostId({
  hosts,
  requestedHostId,
}: {
  hosts: Map<string, HostDevSession>;
  requestedHostId?: string;
}): string | undefined {
  if (requestedHostId) return requestedHostId;

  if (hosts.size !== 1) return undefined;

  return hosts.keys().next().value;
}
