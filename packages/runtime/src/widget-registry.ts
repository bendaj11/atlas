import {
  assertAtlasHostManifest,
  assertAtlasManifest,
  type AtlasExportedWidgetManifest,
  type AtlasHostCatalog,
  type AtlasHostRuntimeConfig,
  type AtlasManifest,
  type AtlasProductionSelection,
  type AtlasStaticRegistry
} from "@atlas/schema";

export interface AtlasResolvedWidget {
  widget: AtlasExportedWidgetManifest;
  ownerManifest: AtlasManifest;
}

export type AtlasWidgetResolver = (widgetId: string) => Promise<AtlasResolvedWidget>;

interface RegistrySnapshot {
  url: string;
  registry: AtlasStaticRegistry;
}

type LazyRegistry = () => Promise<RegistrySnapshot>;

interface WidgetRegistryOptions {
  runtimeConfig: AtlasHostRuntimeConfig;
  catalog: AtlasHostCatalog;
  fetchJson?: (url: string) => Promise<unknown>;
}

/** Creates page-scoped, lazy widget discovery for primary and explicitly configured external registries. */
export function createRegistryWidgetResolver(options: WidgetRegistryOptions): AtlasWidgetResolver {
  const selectedApps = new Map(options.catalog.apps.map((manifest) => [manifest.id, manifest]));
  const overriddenProviders = new Map((options.catalog.widgetProviders ?? []).map((manifest) => [manifest.id, manifest]));
  const warnedDuplicateWidgetIds = new Set<string>();
  const primaryRegistry = lazyRegistry(() => primaryRegistryUrl(options.runtimeConfig.catalogUrl), options.fetchJson);
  const externalRegistries = (options.runtimeConfig.externalRegistryUrls ?? [])
    .map((url) => lazyRegistry(registryJsonUrl(url), options.fetchJson));
  const externalRootIds = [...new Set(options.catalog.apps.flatMap((manifest) => manifest.externalAppsDependencies ?? []))];
  const firstWidget = (widgetId: string, manifests: AtlasManifest[]): AtlasResolvedWidget | undefined =>
    uniqueWidget(widgetId, manifests, (firstOwnerId) => {
      if (warnedDuplicateWidgetIds.has(widgetId)) return;
      warnedDuplicateWidgetIds.add(widgetId);
      console.warn(`Atlas widget id "${widgetId}" is exported by multiple apps; using first match from "${firstOwnerId}".`);
    });

  return async (widgetId) => {
    assertWidgetId(widgetId);
    const selectedMatch = firstWidget(widgetId, [...selectedApps.values()]);
    if (selectedMatch) return selectedMatch;
    const overrideMatch = firstWidget(widgetId, [...overriddenProviders.values()]);
    if (overrideMatch) return overrideMatch;

    const externalLoading = externalRegistries.map((load) => settleRegistry(load()));
    const primary = await settleRegistry(primaryRegistry());
    if (primary.snapshot) {
      const primaryMatch = firstWidget(widgetId, selectProductionApps(primary.snapshot.registry)
        .filter((manifest) => !selectedApps.has(manifest.id)));
      if (primaryMatch) return primaryMatch;
    }

    const external = await Promise.all(externalLoading);
    const snapshots = external.flatMap((result) => result.snapshot ? [result.snapshot] : []);
    const externalApps = resolveExternalDependencyGraph(externalRootIds, snapshots)
      .filter((manifest) => !overriddenProviders.has(manifest.id));
    const externalMatch = firstWidget(widgetId, externalApps);
    if (externalMatch) return externalMatch;

    const failures = [primary, ...external].flatMap((result) => result.error ? [result.error.message] : []);
    const detail = failures.length ? ` Unavailable registries: ${failures.join("; ")}` : "";
    throw new Error(`Atlas widget "${widgetId}" is not exported by an available app.${detail}`);
  };
}

function lazyRegistry(urlSource: string | (() => string), fetchJson: WidgetRegistryOptions["fetchJson"]): LazyRegistry {
  let loading: Promise<RegistrySnapshot> | undefined;
  return () => loading ??= Promise.resolve()
    .then(async () => {
      const url = typeof urlSource === "string" ? urlSource : urlSource();
      const value = await (fetchJson ? fetchJson(url) : fetchRegistry(url));
      return { url, registry: assertRegistry(value, url) };
    })
    .catch((error: unknown) => {
      loading = undefined;
      throw error;
    });
}

async function settleRegistry(promise: Promise<RegistrySnapshot>): Promise<{ snapshot?: RegistrySnapshot; error?: Error }> {
  try { return { snapshot: await promise }; }
  catch (error) { return { error: toError(error) }; }
}

async function fetchRegistry(url: string): Promise<unknown> {
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.json();
}

function primaryRegistryUrl(catalogUrl: string): string {
  const url = new URL(catalogUrl, globalThis.location?.href ?? "http://atlas.local");
  const match = url.pathname.match(/^(.*)\/hosts\/[^/]+\/catalog\.json$/);
  if (!match) throw new Error(`Atlas catalog URL "${url.href}" does not use hosts/<host-id>/catalog.json layout.`);
  url.pathname = `${match[1]}/registry.json`.replace(/\/+/g, "/");
  url.search = "";
  url.hash = "";
  return url.href;
}

function registryJsonUrl(baseUrl: string): string {
  return new URL("registry.json", `${baseUrl.replace(/\/$/, "")}/`).href;
}

function assertRegistry(value: unknown, url: string): AtlasStaticRegistry {
  if (!isRecord(value) || value.schemaVersion !== "1" || !Array.isArray(value.apps) || !Array.isArray(value.hosts)) {
    throw new Error(`${url} is not an Atlas registry`);
  }
  value.apps.forEach(assertAtlasManifest);
  value.hosts.forEach(assertAtlasHostManifest);
  return value as unknown as AtlasStaticRegistry;
}

function selectProductionApps(registry: AtlasStaticRegistry): AtlasManifest[] {
  const ids = [...new Set(registry.apps.map((manifest) => manifest.id))];
  return ids.flatMap((id) => {
    const manifest = selectProductionApp(registry, id);
    return manifest ? [manifest] : [];
  });
}

function selectProductionApp(registry: AtlasStaticRegistry, appId: string): AtlasManifest | undefined {
  const production = registry.apps.filter((manifest) => manifest.id === appId && manifest.channel === "production");
  const selection = registry.selections?.apps?.[appId];
  if (selection) return production.find((manifest) => matchesSelection(manifest, selection));
  return production.sort(compareNewestFirst)[0];
}

function matchesSelection(manifest: AtlasManifest, selection: AtlasProductionSelection): boolean {
  return manifest.version === selection.version && manifest.buildId === selection.buildId;
}

function compareNewestFirst(left: AtlasManifest, right: AtlasManifest): number {
  return right.version.localeCompare(left.version, undefined, { numeric: true, sensitivity: "base" })
    || right.createdAt.localeCompare(left.createdAt)
    || right.buildId.localeCompare(left.buildId);
}

function resolveExternalDependencyGraph(rootIds: string[], snapshots: RegistrySnapshot[]): AtlasManifest[] {
  const resolved = new Map<string, AtlasManifest>();
  const pending = [...rootIds];
  while (pending.length > 0) {
    const appId = pending.shift()!;
    if (resolved.has(appId)) continue;
    const candidates = snapshots.flatMap(({ registry }) => {
      const manifest = selectProductionApp(registry, appId);
      return manifest ? [manifest] : [];
    });
    if (candidates.length === 0) throw new Error(`External Atlas app dependency "${appId}" was not found in configured registries.`);
    if (candidates.length > 1) throw new Error(`External Atlas app dependency "${appId}" exists in multiple configured registries.`);
    const manifest = candidates[0]!;
    resolved.set(appId, manifest);
    pending.push(...(manifest.externalAppsDependencies ?? []));
  }
  return [...resolved.values()];
}

function uniqueWidget(
  widgetId: string,
  manifests: AtlasManifest[],
  onDuplicate: (firstOwnerId: string) => void
): AtlasResolvedWidget | undefined {
  const candidates = manifests.flatMap((ownerManifest) => (ownerManifest.exportedWidgets ?? [])
    .filter((widget) => widget.id === widgetId)
    .map((widget) => ({ widget, ownerManifest })));
  if (candidates.length > 1) onDuplicate(candidates[0]!.ownerManifest.id);
  return candidates[0];
}

function assertWidgetId(widgetId: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(widgetId)) {
    throw new Error(`Atlas getWidget requires a UUIDv4 widget id. Received "${widgetId}".`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
