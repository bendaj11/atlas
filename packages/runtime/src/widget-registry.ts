import type {
  AtlasAppManifest,
  AtlasExportedWidgetManifest,
  AtlasHostCatalog,
  AtlasHostRuntimeConfig,
  AtlasManifestDescriptor,
  AtlasStaticRegistry,
} from '@atlas/schema';
import { loadPublishedManifest } from './loader/runtime-discovery.js';
import { runtimeError } from './runtime-error.js';

export interface AtlasResolvedWidget {
  widget: AtlasExportedWidgetManifest;
  ownerManifest: AtlasAppManifest;
}

export type AtlasWidgetResolver = (
  widgetId: string,
) => Promise<AtlasResolvedWidget>;

interface WidgetRegistryOptions {
  runtimeConfig: AtlasHostRuntimeConfig;
  catalog: AtlasHostCatalog;
  fetchJson?: (url: string) => Promise<unknown>;
  fetchBytes?: (url: string, signal?: AbortSignal) => Promise<ArrayBuffer>;
}

interface ExternalSnapshot {
  rootUrl: string;
  environment: string;
  registry: AtlasStaticRegistry;
}

/** Resolves known widgets immediately and external providers lazily by explicit environment. */
export function createRegistryWidgetResolver(
  options: WidgetRegistryOptions,
): AtlasWidgetResolver {
  const selected = [
    ...options.catalog.apps,
    ...(options.catalog.widgetProviders ?? []),
  ];
  const widgets = indexWidgets(selected);
  const pending = new Map<string, Promise<AtlasResolvedWidget>>();
  let externalWidgets: Promise<Map<string, AtlasResolvedWidget>> | undefined;

  return (widgetId) => {
    assertWidgetId(widgetId);
    const known = widgets.get(widgetId);
    if (known) return Promise.resolve(known);
    const existing = pending.get(widgetId);
    if (existing) return existing;
    const resolving = (externalWidgets ??= discoverExternalWidgets(options))
      .then((discovered) => {
        const match = discovered.get(widgetId);
        if (!match) {
          throw runtimeError(
            `Atlas could not find widget "${widgetId}" in the selected deployment environments.`,
            {
              code: 'ATLAS_WIDGET_NOT_FOUND',
              suggestedActions: [
                'Confirm the widget UUID and external registry environment.',
                'Deploy the provider app to that environment and retry.',
              ],
            },
          );
        }
        widgets.set(widgetId, match);
        return match;
      })
      .finally(() => pending.delete(widgetId));
    pending.set(widgetId, resolving);
    return resolving;
  };
}

async function discoverExternalWidgets(
  options: WidgetRegistryOptions,
): Promise<Map<string, AtlasResolvedWidget>> {
  const roots = [
    ...new Set(
      options.catalog.apps.flatMap(
        (manifest) => manifest.externalAppsDependencies ?? [],
      ),
    ),
  ];
  if (!roots.length) return new Map();
  const snapshots = await Promise.all(
    (options.runtimeConfig.externalRegistries ?? []).map(async (external) => {
      const rootUrl = external.registryUrl.replace(/\/$/, '');
      const value = await (options.fetchJson ?? fetchRegistry)(
        new URL('registry.json', `${rootUrl}/`).href,
      );
      return {
        rootUrl,
        environment: external.environment,
        registry: assertRegistry(value, rootUrl),
      };
    }),
  );
  const manifests = new Map<string, AtlasAppManifest>();
  const queue = [...roots];
  while (queue.length) {
    const appId = queue.shift()!;
    if (manifests.has(appId)) continue;
    const manifest = await loadExternalApp(
      appId,
      snapshots,
      options.fetchBytes,
    );
    manifests.set(appId, manifest);
    queue.push(...(manifest.externalAppsDependencies ?? []));
  }
  return indexWidgets([...manifests.values()]);
}

async function loadExternalApp(
  appId: string,
  snapshots: readonly ExternalSnapshot[],
  fetchBytes?: WidgetRegistryOptions['fetchBytes'],
): Promise<AtlasAppManifest> {
  const candidates = snapshots.flatMap((snapshot) => {
    const selection =
      snapshot.registry.deployments[snapshot.environment]?.apps[appId];
    const descriptor = selection
      ? snapshot.registry.apps[appId]?.releases[selection.version]
      : undefined;
    return selection && descriptor
      ? [{ snapshot, descriptor, version: selection.version }]
      : [];
  });
  if (candidates.length !== 1) {
    const reason = candidates.length ? 'is ambiguous' : 'was not found';
    throw runtimeError(
      `External app dependency "${appId}" ${reason} in the configured environments.`,
      {
        code: candidates.length
          ? 'ATLAS_EXTERNAL_APP_AMBIGUOUS'
          : 'ATLAS_EXTERNAL_APP_NOT_FOUND',
        suggestedActions:
          'Select one registry environment that owns this app and deploy it there.',
      },
    );
  }
  const { snapshot, descriptor, version } = candidates[0]!;
  const reference = descriptorReference(snapshot.rootUrl, descriptor);
  const manifest = await loadPublishedManifest(reference, fetchBytes);
  if (
    manifest.kind !== 'app' ||
    manifest.id !== appId ||
    manifest.version !== version
  ) {
    throw runtimeError(
      `External dependency "${appId}" does not match its registry selection.`,
      {
        code: 'ATLAS_EXTERNAL_APP_INVALID',
        suggestedActions: 'Correct the external registry deployment selection.',
      },
    );
  }
  return manifest;
}

function descriptorReference(
  rootUrl: string,
  descriptor: AtlasManifestDescriptor,
): AtlasManifestDescriptor & { url: string } {
  return {
    ...descriptor,
    url: new URL(descriptor.path, `${rootUrl}/`).href,
  };
}

function indexWidgets(
  manifests: readonly AtlasAppManifest[],
): Map<string, AtlasResolvedWidget> {
  const widgets = new Map<string, AtlasResolvedWidget>();
  for (const ownerManifest of manifests) {
    for (const widget of ownerManifest.exportedWidgets ?? []) {
      const existing = widgets.get(widget.id);
      if (existing && existing.ownerManifest.id !== ownerManifest.id) {
        throw runtimeError(
          `Atlas found widget "${widget.id}" in more than one provider app.`,
          {
            code: 'ATLAS_WIDGET_AMBIGUOUS',
            suggestedActions:
              'Give every exported widget a globally unique UUID.',
          },
        );
      }
      widgets.set(widget.id, { widget, ownerManifest });
    }
  }
  return widgets;
}

async function fetchRegistry(url: string): Promise<unknown> {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) {
    throw runtimeError(`Atlas could not load external registry "${url}".`, {
      code: 'ATLAS_REGISTRY_HTTP_ERROR',
      suggestedActions:
        'Check the registry URL, environment, CORS, and network response.',
    });
  }
  return response.json();
}

function assertRegistry(value: unknown, url: string): AtlasStaticRegistry {
  if (
    typeof value !== 'object' ||
    value === null ||
    (value as AtlasStaticRegistry).schemaVersion !== '2' ||
    typeof (value as AtlasStaticRegistry).apps !== 'object' ||
    typeof (value as AtlasStaticRegistry).deployments !== 'object'
  ) {
    throw runtimeError(`Atlas received an invalid registry from "${url}".`, {
      code: 'ATLAS_REGISTRY_INVALID',
      suggestedActions: 'Deploy schemaVersion "2" registry.json.',
    });
  }
  return value as AtlasStaticRegistry;
}

function assertWidgetId(widgetId: string): void {
  if (!widgetId.trim()) {
    throw runtimeError('Atlas widget id cannot be empty.', {
      code: 'ATLAS_WIDGET_ID_INVALID',
      suggestedActions: 'Pass the UUID from the exported widget manifest.',
    });
  }
}
