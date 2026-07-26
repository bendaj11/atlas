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
import { runtimeError } from "./runtime-error.js";

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
  const selectedWidgets = indexWidgets([...selectedApps.values()], warnedDuplicateWidgetIds);
  const overriddenWidgets = indexWidgets([...overriddenProviders.values()], warnedDuplicateWidgetIds);
  const resolvedWidgets = new Map([...overriddenWidgets, ...selectedWidgets]);
  const resolvingWidgets = new Map<string, Promise<AtlasResolvedWidget>>();
  const primaryRegistry = lazyRegistry(() => primaryRegistryUrl(options.runtimeConfig.catalogUrl), options.fetchJson);
  const externalRegistries = (options.runtimeConfig.externalRegistryUrls ?? [])
    .map((url) => lazyRegistry(registryJsonUrl(url), options.fetchJson));
  const externalRootIds = [...new Set(options.catalog.apps.flatMap((manifest) => manifest.externalAppsDependencies ?? []))];
  let primaryLoading: Promise<{ result: Awaited<ReturnType<typeof settleRegistry>>; widgets: Map<string, AtlasResolvedWidget> }> | undefined;
  let externalLoading: Promise<{
    results: Awaited<ReturnType<typeof settleRegistry>>[];
    widgets: Map<string, AtlasResolvedWidget>;
    error?: Error;
  }> | undefined;

  const startDiscovery = (): void => {
    primaryLoading ??= settleRegistry(primaryRegistry()).then((result) => ({
      result,
      widgets: indexWidgets(
        result.snapshot
          ? selectProductionApps(result.snapshot.registry).filter((manifest) => !selectedApps.has(manifest.id))
          : [],
        warnedDuplicateWidgetIds
      )
    }));
    externalLoading ??= Promise.all(externalRegistries.map((load) => settleRegistry(load()))).then((results) => {
      const snapshots = results.flatMap((result) => result.snapshot ? [result.snapshot] : []);
      try {
        const manifests = resolveExternalDependencyGraph(externalRootIds, snapshots)
          .filter((manifest) => !overriddenProviders.has(manifest.id));
        return { results, widgets: indexWidgets(manifests, warnedDuplicateWidgetIds) };
      } catch (error) {
        return { results, widgets: new Map<string, AtlasResolvedWidget>(), error: toError(error) };
      }
    });
  };

  const resolveUnknownWidget = async (widgetId: string): Promise<AtlasResolvedWidget> => {
    startDiscovery();
    const primary = await primaryLoading!;
    const primaryMatch = primary.widgets.get(widgetId);
    if (primaryMatch) return primaryMatch;

    const external = await externalLoading!;
    const externalMatch = external.widgets.get(widgetId);
    if (externalMatch) return externalMatch;

    const failures = [
      ...[primary.result, ...external.results].flatMap((result) => result.error ? [result.error.message] : []),
      ...(external.error ? [external.error.message] : [])
    ];
    const detail = failures.length ? ` Unavailable registries: ${failures.join("; ")}` : "";
    if (failures.length > 0) {
      primaryLoading = undefined;
      externalLoading = undefined;
    }
    throw runtimeError(
      `Atlas could not find widget "${widgetId}" in any available app.${detail}`,
      {
        code: "ATLAS_WIDGET_NOT_FOUND",
        suggestedActions: [
          "Confirm the widget UUID matches an exportedWidgets entry in the owning app manifest.",
          "Publish the owning app to the configured registry, then reload the page."
        ]
      }
    );
  };

  return (widgetId) => {
    assertWidgetId(widgetId);
    const known = resolvedWidgets.get(widgetId);
    if (known) return Promise.resolve(known);
    const pending = resolvingWidgets.get(widgetId);
    if (pending) return pending;
    const resolving = resolveUnknownWidget(widgetId)
      .then((resolved) => {
        resolvedWidgets.set(widgetId, resolved);
        return resolved;
      })
      .finally(() => resolvingWidgets.delete(widgetId));
    resolvingWidgets.set(widgetId, resolving);
    return resolving;
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
  if (!response.ok) {
    throw runtimeError(
      `Atlas could not load the widget registry at "${url}" because the server returned HTTP ${response.status}.`,
      {
        code: "ATLAS_REGISTRY_HTTP_ERROR",
        suggestedActions: [
          "Confirm the registry URL is correct and the registry is deployed.",
          "Check the registry server and browser network response, including CORS settings."
        ]
      }
    );
  }
  return response.json();
}

function primaryRegistryUrl(catalogUrl: string): string {
  const url = new URL(catalogUrl, globalThis.location?.href ?? "http://atlas.local");
  const match = url.pathname.match(/^(.*)\/hosts\/[^/]+\/catalog\.json$/);
  if (!match) {
    throw runtimeError(
      `Atlas cannot locate the registry from catalog URL "${url.href}" because it does not follow the expected host catalog layout.`,
      {
        code: "ATLAS_CATALOG_URL_LAYOUT_INVALID",
        suggestedActions: `Set catalogUrl to a URL ending in "hosts/<host-id>/catalog.json".`
      }
    );
  }
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
    throw runtimeError(
      `Atlas received an invalid registry document from "${url}".`,
      {
        code: "ATLAS_REGISTRY_INVALID",
        suggestedActions: "Deploy a valid Atlas registry.json document with schemaVersion \"1\", apps, and hosts arrays."
      }
    );
  }
  value.apps.forEach(assertAtlasManifest);
  value.hosts.forEach(assertAtlasHostManifest);
  return value as unknown as AtlasStaticRegistry;
}

function selectProductionApps(registry: AtlasStaticRegistry): AtlasManifest[] {
  const byId = new Map<string, AtlasManifest[]>();
  for (const manifest of registry.apps) {
    if (manifest.channel !== "production") continue;
    const versions = byId.get(manifest.id) ?? [];
    versions.push(manifest);
    byId.set(manifest.id, versions);
  }
  return [...byId].flatMap(([id, production]) => {
    const selection = registry.selections?.apps?.[id];
    const selected = selection
      ? production.find((manifest) => matchesSelection(manifest, selection))
      : production.sort(compareNewestFirst)[0];
    return selected ? [selected] : [];
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
    if (candidates.length === 0) {
      throw runtimeError(
        `Atlas could not find external app dependency "${appId}" in any configured registry.`,
        {
          code: "ATLAS_EXTERNAL_APP_NOT_FOUND",
          suggestedActions: [
            `Publish app "${appId}" to one of the configured external registries.`,
            "Confirm externalRegistryUrls includes the registry that owns this app."
          ]
        }
      );
    }
    if (candidates.length > 1) {
      throw runtimeError(
        `Atlas found external app dependency "${appId}" in more than one configured registry and cannot choose one safely.`,
        {
          code: "ATLAS_EXTERNAL_APP_AMBIGUOUS",
          suggestedActions: [
            `Keep app "${appId}" in only one configured external registry.`,
            "Remove duplicate or unintended URLs from externalRegistryUrls."
          ]
        }
      );
    }
    const manifest = candidates[0]!;
    resolved.set(appId, manifest);
    pending.push(...(manifest.externalAppsDependencies ?? []));
  }
  return [...resolved.values()];
}

function indexWidgets(
  manifests: readonly AtlasManifest[],
  warnedDuplicateWidgetIds: Set<string>
): Map<string, AtlasResolvedWidget> {
  const entries = new Map<string, AtlasResolvedWidget>();
  for (const ownerManifest of manifests) {
    for (const widget of ownerManifest.exportedWidgets ?? []) {
      const existing = entries.get(widget.id);
      if (!existing) {
        entries.set(widget.id, { widget, ownerManifest });
        continue;
      }
      if (existing.ownerManifest.id === ownerManifest.id || warnedDuplicateWidgetIds.has(widget.id)) continue;
      warnedDuplicateWidgetIds.add(widget.id);
      console.warn(
        `Atlas found widget id "${widget.id}" in multiple apps and selected "${existing.ownerManifest.id}". ` +
        "Suggested action: Assign a unique UUIDv4 to each exported widget, rebuild the affected apps, and republish their manifests."
      );
    }
  }
  return entries;
}

function assertWidgetId(widgetId: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(widgetId)) {
    throw runtimeError(
      `Atlas cannot load widget "${widgetId}" because its identifier is not a valid UUIDv4.`,
      {
        code: "ATLAS_WIDGET_ID_INVALID",
        suggestedActions: "Pass the UUIDv4 from the widget's exportedWidgets manifest entry to getWidget."
      }
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
