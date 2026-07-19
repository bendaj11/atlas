import type { AtlasExtensionManifest as Manifest, AtlasHostData as HostData, AtlasOverrideDocument as OverrideDocument } from "../contracts.js";
import type { Scope } from "./types.js";

export async function inspectAtlasHost(documentKey: string): Promise<HostData> {
  function manifestKey(manifest: Manifest): string {
    return `${manifest.kind}:${manifest.id}`;
  }

  type ArtifactSelection = { version: string; buildId: string };
  type ExternalRegistry = { apps: Manifest[]; selections?: { apps?: Record<string, ArtifactSelection> } };
  type ExternalRegistryResult = { registry?: ExternalRegistry; error?: string };
  type ExternalProviders = { providers: Manifest[]; versions: Array<readonly [string, Manifest[]]>; errors: string[] };

  function objectValue(value: unknown): Record<string, unknown> | undefined {
    return typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;
  }

  function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((item) => typeof item === "string");
  }

  function isManifest(value: unknown): value is Manifest {
    const manifest = objectValue(value);
    return manifest?.schemaVersion === "1"
      && (manifest.kind === "host" || manifest.kind === "app")
      && typeof manifest.id === "string"
      && typeof manifest.name === "string"
      && typeof manifest.version === "string"
      && typeof manifest.buildId === "string"
      && (manifest.channel === "production" || manifest.channel === "pr" || manifest.channel === "local")
      && (manifest.framework === "angular" || manifest.framework === "react" || manifest.framework === "vue")
      && typeof manifest.remoteEntryUrl === "string"
      && (manifest.externalAppsDependencies === undefined || isStringArray(manifest.externalAppsDependencies));
  }

  function isRuntimeConfig(value: unknown): value is HostData["config"] {
    const config = objectValue(value);
    return config?.schemaVersion === "1"
      && typeof config.hostId === "string"
      && typeof config.catalogUrl === "string"
      && (config.allowCustomOverrides === undefined || typeof config.allowCustomOverrides === "boolean")
      && (config.externalRegistryUrls === undefined || isStringArray(config.externalRegistryUrls));
  }

  function isCatalog(value: unknown): value is HostData["catalog"] {
    const catalog = objectValue(value);
    return catalog?.schemaVersion === "1"
      && typeof catalog.hostId === "string"
      && typeof catalog.revision === "string"
      && isManifest(catalog.host)
      && Array.isArray(catalog.apps)
      && catalog.apps.every(isManifest);
  }

  function isArtifactSelection(value: unknown): value is ArtifactSelection {
    const selection = objectValue(value);
    return typeof selection?.version === "string" && typeof selection.buildId === "string";
  }

  function isSelectionDocument(value: unknown): value is ExternalRegistry["selections"] {
    if (value === undefined) return true;
    const selections = objectValue(value);
    if (!selections) return false;
    if (selections.apps === undefined) return true;
    const apps = objectValue(selections.apps);
    return apps !== undefined && Object.values(apps).every(isArtifactSelection);
  }

  function isExternalRegistry(value: unknown): value is ExternalRegistry {
    const registry = objectValue(value);
    return Array.isArray(registry?.apps)
      && registry.apps.every(isManifest)
      && isSelectionDocument(registry.selections);
  }

  function isOverride(value: unknown): value is OverrideDocument["apps"][number] {
    const override = objectValue(value);
    return isManifest(override?.manifest)
      && (override.reason === "local" || override.reason === "pr" || override.reason === "past-production");
  }

  function isOverrideDocument(value: unknown): value is OverrideDocument {
    const documentValue = objectValue(value);
    return documentValue?.schemaVersion === "1"
      && typeof documentValue.hostId === "string"
      && typeof documentValue.generatedAt === "string"
      && (documentValue.host === undefined || isOverride(documentValue.host))
      && Array.isArray(documentValue.apps)
      && documentValue.apps.every(isOverride);
  }

  async function readAtlasConfig(): Promise<HostData["config"]> {
    const response = await fetch("/atlas.runtime.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Atlas runtime configuration returned ${response.status}.`);

    const config: unknown = await response.json();
    if (!isRuntimeConfig(config)) throw new Error("This page does not expose a valid Atlas runtime configuration.");

    return config;
  }

  async function readAtlasCatalog(catalogUrl: URL): Promise<HostData["catalog"]> {
    const response = await fetch(catalogUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`Atlas catalog returned ${response.status}.`);

    const catalog: unknown = await response.json();
    if (!isCatalog(catalog)) throw new Error("Atlas catalog returned invalid data.");
    return catalog;
  }

  async function readManifestVersions(manifest: Manifest, registryRoot: string): Promise<{ entry: readonly [string, Manifest[]]; error?: string }> {
    try {
      const response = await fetch(`${registryRoot}/${manifest.kind === "host" ? "hosts" : "apps"}/${encodeURIComponent(manifest.id)}/index.json`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Version lookup for ${manifest.id} returned ${response.status}.`);

      const index = objectValue(await response.json());
      if (!Array.isArray(index?.manifests) || !index.manifests.every(isManifest)) {
        throw new Error(`Version lookup for ${manifest.id} returned an invalid index.`);
      }

      return { entry: [manifestKey(manifest), index.manifests] as const };
    } catch (error) {
      return { entry: [manifestKey(manifest), [manifest]] as const, error: messageFromError(error) };
    }
  }

  async function readExternalRegistry(baseUrl: string): Promise<ExternalRegistryResult> {
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, "")}/registry.json`, { cache: "no-store" });
      if (!response.ok) throw new Error(`External registry ${baseUrl} returned ${response.status}.`);
      const registry: unknown = await response.json();
      if (!isExternalRegistry(registry)) throw new Error(`External registry ${baseUrl} returned invalid apps.`);
      return { registry };
    } catch (error) {
      return { error: messageFromError(error) };
    }
  }

  function selectedProvider(appId: string, registry: ExternalRegistry): { selected?: Manifest; versions: Manifest[] } {
    const versions = registry.apps.filter((manifest) => manifest.id === appId);
    const production = versions.filter((manifest) => manifest.channel === "production");
    const selection = registry.selections?.apps?.[appId];
    const selected = selection
      ? production.find((manifest) => manifest.version === selection.version && manifest.buildId === selection.buildId)
      : production.sort((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? ""))[0];
    return { ...(selected ? { selected } : {}), versions };
  }

  function resolveExternalProviders(dependencyIds: Set<string>, registries: ExternalRegistry[]): Omit<ExternalProviders, "errors"> {
    const providers: Manifest[] = [];
    const versions: Array<readonly [string, Manifest[]]> = [];
    const pending = [...dependencyIds];
    const resolved = new Set<string>();
    while (pending.length) {
      const appId = pending.shift();
      if (appId === undefined) break;
      if (resolved.has(appId)) continue;
      const matches = registries.map((registry) => selectedProvider(appId, registry));
      versions.push(...matches.filter((match) => match.versions.length > 0).map((match) => [`app:${appId}`, match.versions] as const));
      const candidates = matches.flatMap(({ selected }) => selected ? [selected] : []);
      const provider = candidates.length === 1 ? candidates[0] : undefined;
      if (provider) {
        providers.push(provider);
        pending.push(...(provider.externalAppsDependencies ?? []));
      }
      resolved.add(appId);
    }
    return { providers, versions };
  }

  async function readExternalProviders(config: HostData["config"], catalog: HostData["catalog"]): Promise<ExternalProviders> {
    const dependencyIds = new Set(catalog.apps.flatMap((manifest) => manifest.externalAppsDependencies ?? []));
    if (dependencyIds.size === 0) return { providers: [], versions: [], errors: [] };
    const results = await Promise.all((config.externalRegistryUrls ?? []).map(readExternalRegistry));
    const registries = results.flatMap(({ registry }) => registry ? [registry] : []);
    const resolved = resolveExternalProviders(dependencyIds, registries);
    return {
      ...resolved,
      errors: results.flatMap(({ error }) => error ? [error] : [])
    };
  }

  function atlasRegistryRoot(catalogUrl: URL): string {
    const hostsMarker = "/hosts/";
    const markerIndex = catalogUrl.pathname.indexOf(hostsMarker);

    if (markerIndex < 0) throw new Error("Atlas catalog URL does not identify a static Atlas registry.");

    return `${catalogUrl.origin}${catalogUrl.pathname.slice(0, markerIndex)}`;
  }

  function readStoredOverrideDocument(): { overrides: OverrideDocument | undefined; overrideScope: Scope | undefined } {
    const tabStored = sessionStorage.getItem(documentKey);
    const stored = tabStored ?? localStorage.getItem(documentKey);

    if (!stored) return { overrides: undefined, overrideScope: undefined };

    try {
      const overrides: unknown = JSON.parse(stored);
      return {
        overrides: isOverrideDocument(overrides) ? overrides : undefined,
        overrideScope: tabStored ? "tab" : "all"
      };
    } catch {
      return { overrides: undefined, overrideScope: tabStored ? "tab" : "all" };
    }
  }

  function messageFromError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  function createLocalOverrides(config: HostData["config"], selectedArtifacts: Manifest[]): OverrideDocument | undefined {
    const localSelections = selectedArtifacts.filter((manifest) => manifest.channel === "local");
    if (localSelections.length === 0) return undefined;
    const host = localSelections.find((manifest) => manifest.kind === "host");
    return {
      schemaVersion: "1" as const,
      hostId: config.hostId,
      generatedAt: new Date().toISOString(),
      ...(host ? { host: { manifest: host, reason: "local" as const } } : {}),
      apps: localSelections
        .filter((manifest) => manifest.kind === "app")
        .map((manifest) => ({ manifest, reason: "local" as const }))
    };
  }

  function productionManifest(manifest: Manifest, versions: HostData["versions"]): Manifest {
    if (manifest.channel !== "local") return manifest;
    return versions[manifestKey(manifest)]?.find((version) => version.channel === "production") ?? manifest;
  }

  function createProductionCatalog(
    catalog: HostData["catalog"],
    versions: HostData["versions"],
    widgetProviders: Manifest[]
  ): HostData["catalog"] {
    return {
      ...catalog,
      host: productionManifest(catalog.host, versions),
      apps: catalog.apps.map((manifest) => productionManifest(manifest, versions)),
      widgetProviders
    };
  }

  function readRuntimeErrors(): string[] {
    return [...document.querySelectorAll<HTMLElement>('[data-atlas-state="error"]')]
      .map((element) => element.textContent?.trim() || element.getAttribute("data-atlas-app") || "Unknown app error");
  }

  function readVersionErrors(
    results: Array<{ entry: readonly [string, Manifest[]]; error?: string }>,
    externalErrors: string[]
  ): string[] {
    return [
      ...results.map(({ error }) => error).filter((error): error is string => Boolean(error)),
      ...externalErrors
    ];
  }

  const config = await readAtlasConfig();
  const catalogUrl = new URL(config.catalogUrl, location.href);
  const catalog = await readAtlasCatalog(catalogUrl);
  const external = await readExternalProviders(config, catalog);
  const registryRoot = atlasRegistryRoot(catalogUrl);
  const selectedArtifacts = [catalog.host, ...catalog.apps];
  const versionResults = await Promise.all(selectedArtifacts.map((manifest) => readManifestVersions(manifest, registryRoot)));
  const versions = Object.fromEntries([...versionResults.map(({ entry }) => entry), ...external.versions]);
  const storedSelection = readStoredOverrideDocument();
  const overrides = storedSelection.overrides ?? createLocalOverrides(config, selectedArtifacts);
  const productionCatalog = createProductionCatalog(catalog, versions, external.providers);

  return {
    config,
    pageUrl: location.href,
    catalog: productionCatalog,
    versions,
    overrides,
    overrideScope: storedSelection.overrideScope,
    runtimeErrors: readRuntimeErrors(),
    versionErrors: readVersionErrors(versionResults, external.errors)
  };
}
