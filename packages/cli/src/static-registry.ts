import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import {
  assertAtlasManifest,
  type AtlasHostCatalog,
  type AtlasManifest,
  type AtlasMicrofrontendIndex,
  type AtlasProductionSelection,
  type AtlasStaticRegistry
} from "@atlas/contracts";

export interface AtlasRegistryResult {
  hostIds: string[];
  baseRevision: string;
  registryRevision: string;
}

export async function prepareStaticRegistry(
  manifest: AtlasManifest,
  current: AtlasStaticRegistry | undefined,
  outputDirectory: string
): Promise<AtlasRegistryResult> {
  assertStaticRegistry(current);
  assertAtlasManifest(manifest);
  assertSafeRegistryId(manifest.id, "microfrontend ID");
  const manifests = replacePublishedManifest(current?.manifests ?? [], manifest);
  const updatedAt = manifest.createdAt;
  const productionSelections = selectPublishedProduction(current?.productionSelections, manifest);
  const baseRevision = registryRevision(current?.manifests ?? [], current?.productionSelections);
  const nextRevision = registryRevision(manifests, productionSelections);
  const registry: AtlasStaticRegistry = { schemaVersion: "1", revision: nextRevision, updatedAt, manifests, productionSelections };
  const mfIndex: AtlasMicrofrontendIndex = {
    schemaVersion: "1",
    mfId: manifest.id,
    updatedAt,
    manifests: manifests.filter((candidate) => candidate.id === manifest.id).sort(compareManifestNewestFirst)
  };

  await writeJson(outputDirectory, "registry.json", registry);
  await writeJson(outputDirectory, `microfrontends/${manifest.id}/index.json`, mfIndex);

  const hostIds = discoverHostIds(manifests);
  for (const hostId of hostIds) {
    assertSafeRegistryId(hostId, "host ID");
    await writeJson(outputDirectory, `hosts/${hostId}/catalog.json`, createHostCatalog(hostId, manifests, updatedAt, productionSelections));
  }
  return { hostIds, baseRevision, registryRevision: nextRevision };
}

export function registryRevision(
  manifests: readonly AtlasManifest[],
  productionSelections?: Readonly<Record<string, AtlasProductionSelection>>
): string {
  const canonicalManifests = [...manifests]
    .sort((left, right) => manifestKey(left).localeCompare(manifestKey(right)))
    .map(sortObjectKeys);
  const revisionInput = productionSelections && Object.keys(productionSelections).length > 0
    ? { manifests: canonicalManifests, productionSelections: sortObjectKeys(productionSelections) }
    : canonicalManifests;
  return `sha256:${createHash("sha256").update(JSON.stringify(revisionInput)).digest("hex")}`;
}

export function createHostCatalog(
  hostId: string,
  manifests: AtlasManifest[],
  generatedAt = new Date().toISOString(),
  productionSelections?: Readonly<Record<string, AtlasProductionSelection>>
): AtlasHostCatalog {
  const production = selectOneProductionVersionPerMf(manifests, productionSelections);
  const byId = new Map(production.map((manifest) => [manifest.id, manifest]));
  const directlySupported = production.filter((manifest) => supportsHost(manifest, hostId));
  const included = new Map(directlySupported.map((manifest) => [manifest.id, manifest]));
  const pending = [...directlySupported];

  while (pending.length > 0) {
    const consumer = pending.shift()!;
    for (const reference of consumer.uses ?? []) {
      const [ownerId, widgetId] = reference.split("/");
      if (!ownerId || !widgetId) continue;
      const owner = byId.get(ownerId);
      if (!owner) throw new Error(`Atlas MF "${consumer.id}" uses "${reference}", but no production manifest exists for owner "${ownerId}".`);
      if (!(owner.exportedComponents ?? []).some((widget) => widget.id === widgetId)) {
        throw new Error(`Atlas MF "${consumer.id}" uses "${reference}", but that widget is not exported by "${ownerId}".`);
      }
      if (included.has(ownerId)) continue;
      included.set(ownerId, owner);
      pending.push(owner);
    }
  }

  return {
    schemaVersion: "1",
    hostId,
    generatedAt,
    manifests: [...included.values()].sort((left, right) => left.id.localeCompare(right.id))
  };
}

export async function prepareStaticRollback(options: {
  mfId: string;
  version: string;
  buildId?: string;
  current: AtlasStaticRegistry;
  outputDirectory: string;
  updatedAt?: string;
}): Promise<AtlasRegistryResult & { selected: AtlasManifest }> {
  assertStaticRegistry(options.current);
  const candidates = options.current.manifests.filter((manifest) =>
    manifest.id === options.mfId &&
    manifest.channel === "production" &&
    manifest.version === options.version &&
    (!options.buildId || manifest.buildId === options.buildId));
  if (candidates.length === 0) {
    throw new Error(`No production build found for Atlas MF "${options.mfId}" at version "${options.version}".`);
  }
  if (candidates.length > 1) {
    throw new Error(`Atlas MF "${options.mfId}" has multiple builds for version "${options.version}". Pass --build-id.`);
  }

  const selected = candidates[0]!;
  const updatedAt = options.updatedAt ?? new Date().toISOString();
  const productionSelections = {
    ...(options.current.productionSelections ?? {}),
    [options.mfId]: { version: selected.version, buildId: selected.buildId }
  };
  const baseRevision = registryRevision(options.current.manifests, options.current.productionSelections);
  const nextRevision = registryRevision(options.current.manifests, productionSelections);
  const registry: AtlasStaticRegistry = {
    ...options.current,
    revision: nextRevision,
    updatedAt,
    productionSelections
  };
  await writeJson(options.outputDirectory, "registry.json", registry);
  const hostIds = discoverHostIds(options.current.manifests);
  for (const hostId of hostIds) {
    assertSafeRegistryId(hostId, "host ID");
    await writeJson(options.outputDirectory, `hosts/${hostId}/catalog.json`, createHostCatalog(
      hostId,
      options.current.manifests,
      updatedAt,
      productionSelections
    ));
  }
  return { hostIds, baseRevision, registryRevision: nextRevision, selected };
}

function assertStaticRegistry(registry: AtlasStaticRegistry | undefined): void {
  if (!registry) return;
  if (registry.schemaVersion !== "1" || !Array.isArray(registry.manifests)) {
    throw new Error("The static Atlas registry is malformed or uses an unsupported schema version.");
  }
  for (const manifest of registry.manifests) assertAtlasManifest(manifest);
  for (const [mfId, selection] of Object.entries(registry.productionSelections ?? {})) {
    const exists = registry.manifests.some((manifest) => manifest.id === mfId &&
      manifest.channel === "production" && manifest.version === selection.version && manifest.buildId === selection.buildId);
    if (!exists) throw new Error(`The static Atlas registry selects a missing production build for MF "${mfId}".`);
  }
  const actualRevision = registryRevision(registry.manifests, registry.productionSelections);
  if (registry.revision && registry.revision !== actualRevision) {
    throw new Error(`The static Atlas registry revision is invalid. Expected "${registry.revision}", but its contents produce "${actualRevision}".`);
  }
}

function replacePublishedManifest(manifests: AtlasManifest[], published: AtlasManifest): AtlasManifest[] {
  const key = manifestKey(published);
  return [...manifests.filter((manifest) => manifestKey(manifest) !== key), published]
    .sort((left, right) => left.id.localeCompare(right.id) || compareManifestNewestFirst(left, right));
}

function manifestKey(manifest: AtlasManifest): string {
  return `${manifest.id}:${manifest.channel}:${manifest.version}:${manifest.buildId}`;
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (typeof value !== "object" || value === null) return value;
  const sortedEntries = Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => [key, sortObjectKeys(entry)]);
  return Object.fromEntries(sortedEntries);
}

function discoverHostIds(manifests: AtlasManifest[]): string[] {
  const hostIds = new Set<string>();
  for (const manifest of manifests) {
    for (const hostId of manifest.supportedHosts) if (hostId !== "*") hostIds.add(hostId);
    for (const placement of manifest.placements) hostIds.add(placement.hostId);
  }
  return [...hostIds].sort();
}

function supportsHost(manifest: AtlasManifest, hostId: string): boolean {
  return manifest.supportedHosts.includes("*") ||
    manifest.supportedHosts.includes(hostId) ||
    manifest.placements.some((placement) => placement.hostId === hostId);
}

function selectOneProductionVersionPerMf(
  manifests: AtlasManifest[],
  productionSelections?: Readonly<Record<string, AtlasProductionSelection>>
): AtlasManifest[] {
  const selected = new Map<string, AtlasManifest>();
  for (const manifest of manifests.filter((candidate) => candidate.channel === "production")) {
    const requested = productionSelections?.[manifest.id];
    if (requested && (manifest.version !== requested.version || manifest.buildId !== requested.buildId)) continue;
    const current = selected.get(manifest.id);
    if (!current || compareManifestNewestFirst(manifest, current) < 0) selected.set(manifest.id, manifest);
  }
  return [...selected.values()];
}

function selectPublishedProduction(
  current: Readonly<Record<string, AtlasProductionSelection>> | undefined,
  manifest: AtlasManifest
): Record<string, AtlasProductionSelection> {
  if (manifest.channel !== "production") return { ...(current ?? {}) };
  return {
    ...(current ?? {}),
    [manifest.id]: { version: manifest.version, buildId: manifest.buildId }
  };
}

function compareManifestNewestFirst(left: AtlasManifest, right: AtlasManifest): number {
  const version = right.version.localeCompare(left.version, undefined, { numeric: true, sensitivity: "base" });
  return version || right.createdAt.localeCompare(left.createdAt) || right.buildId.localeCompare(left.buildId);
}

async function writeJson(root: string, relativePath: string, value: unknown): Promise<void> {
  const target = resolve(root, relativePath);
  const pathFromRoot = relative(resolve(root), target);
  if (pathFromRoot === ".." || pathFromRoot.startsWith(`..${sep}`) || isAbsolute(pathFromRoot)) {
    throw new Error(`Registry path "${relativePath}" escapes its output directory.`);
  }
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function assertSafeRegistryId(value: string, subject: string): void {
  if (!/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/i.test(value) || value === "." || value === "..") {
    throw new Error(`Atlas ${subject} "${value}" is not a safe path segment.`);
  }
}
