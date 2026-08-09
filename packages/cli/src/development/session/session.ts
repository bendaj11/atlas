import type { AtlasRuntimeOverrideDocument } from '@atlas/runtime';
import type {
  AtlasHostCatalog,
  AtlasHostManifest,
  AtlasStaticRegistry,
} from '@atlas/schema';
import type {
  AtlasDevOverrideDocument,
  AtlasDevSessionDocument,
  DevSessionStore,
} from '../types.js';
import { LOCAL_HOST_PLACEHOLDER_PORT } from '../constants.js';

export function createLocalDevCatalog(
  document: AtlasDevOverrideDocument,
): AtlasHostCatalog {
  const host =
    document.hostOverride ??
    localHostPlaceholder(document.hostId, document.generatedAt);
  return {
    schemaVersion: '1',
    hostId: document.hostId,
    revision: `local:${document.generatedAt}`,
    generatedAt: document.generatedAt,
    host,
    apps: uniqueManifests(document.overrides),
  };
}

export function createDevSession(
  document: AtlasDevOverrideDocument,
  catalog: AtlasHostCatalog,
  overrideUrl: string,
): AtlasDevSessionDocument {
  return {
    schemaVersion: '1',
    hostId: document.hostId,
    catalog,
    overrides: document.overrides,
    ...(document.hostOverride ? { hostOverride: document.hostOverride } : {}),
    overrideUrl,
    generatedAt: document.generatedAt,
  };
}

export function createDevSessionStore(
  initial: AtlasDevOverrideDocument,
  overrideUrl: string,
): DevSessionStore {
  const hosts = new Map<string, HostDevSession>();
  register(initial);

  function register(document: AtlasDevOverrideDocument): void {
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
    hosts.set(document.hostId, host);
  }

  function currentDocument(
    requestedHostId?: string,
  ): AtlasDevOverrideDocument | undefined {
    const hostId = resolveHostId(hosts, requestedHostId);
    if (!hostId) return undefined;
    const host = hosts.get(hostId);
    if (!host) return undefined;

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
  }

  function matchingHosts(
    appId: string,
    requestedHostId?: string,
  ): HostDevSession[] {
    if (requestedHostId) {
      const host = hosts.get(requestedHostId);
      return host ? [host] : [];
    }
    return [...hosts.values()].filter((host) => host.entries.has(appId));
  }

  function markReady(appId: string, requestedHostId?: string): void {
    for (const host of matchingHosts(appId, requestedHostId)) {
      const entry = host.entries.get(appId);
      if (entry) entry.ready = true;
    }
  }

  function registry(): AtlasStaticRegistry {
    const documents = [...hosts.keys()].flatMap((hostId) => {
      const document = currentDocument(hostId);
      return document ? [document] : [];
    });
    const updatedAt =
      documents
        .map((document) => document.generatedAt)
        .sort()
        .at(-1) ?? initial.generatedAt;
    return {
      schemaVersion: '1',
      revision: `local:${updatedAt}`,
      updatedAt,
      hosts: uniqueArtifacts(
        documents.flatMap((document) =>
          document.hostOverride ? [document.hostOverride] : [],
        ),
      ),
      apps: uniqueArtifacts(
        documents.flatMap((document) =>
          document.overrides.map((override) => override.manifest),
        ),
      ),
    };
  }

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
    catalog(hostId) {
      const document = currentDocument(hostId);
      return document ? createLocalDevCatalog(document) : undefined;
    },
    registry,
    devSession(hostId) {
      const document = currentDocument(hostId);
      return document
        ? createDevSession(
            document,
            createLocalDevCatalog(document),
            overrideUrl,
          )
        : undefined;
    },
    hasReadySession() {
      return [...hosts.keys()].some(
        (hostId) => currentDocument(hostId) !== undefined,
      );
    },
  };
}

interface DevSessionEntry {
  override: AtlasRuntimeOverrideDocument['overrides'][number];
  ready: boolean;
}

interface HostDevSession {
  entries: Map<string, DevSessionEntry>;
  generatedAt: string;
  hostOverride?: AtlasHostManifest;
  hostReady: boolean;
}

function uniqueManifests(
  overrides: AtlasRuntimeOverrideDocument['overrides'],
): AtlasHostCatalog['apps'] {
  return uniqueArtifacts(overrides.map((override) => override.manifest));
}

function uniqueArtifacts<T extends { id: string }>(artifacts: T[]): T[] {
  return [
    ...new Map(artifacts.map((artifact) => [artifact.id, artifact])).values(),
  ];
}

function localHostPlaceholder(
  hostId: string,
  createdAt: string,
): AtlasHostManifest {
  return {
    schemaVersion: '1',
    kind: 'host',
    id: hostId,
    name: hostId,
    version: '0.0.0-local',
    buildId: 'local-placeholder',
    channel: 'local',
    framework: 'react',
    remoteEntryUrl: `http://localhost:${LOCAL_HOST_PLACEHOLDER_PORT}/remoteEntry.json`,
    exposes: { entry: './host' },
    requiredLoaderApiVersion: '^1.0.0',
    createdAt,
  };
}

function createHostDevSession(generatedAt: string): HostDevSession {
  return {
    entries: new Map<string, DevSessionEntry>(),
    generatedAt,
    hostReady: false,
  };
}

function resolveHostId(
  hosts: Map<string, HostDevSession>,
  requestedHostId?: string,
): string | undefined {
  if (requestedHostId) return requestedHostId;
  if (hosts.size !== 1) return undefined;
  return hosts.keys().next().value;
}
