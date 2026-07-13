import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import {
  assertAtlasHostManifest,
  assertAtlasManifest,
  type AtlasAppIndex,
  type AtlasArtifactManifestBase,
  type AtlasHostCatalog,
  type AtlasHostIndex,
  type AtlasHostManifest,
  type AtlasManifest,
  type AtlasProductionSelection,
  type AtlasStaticRegistry
} from "@atlas/schema";

type AtlasArtifactManifest = AtlasHostManifest | AtlasManifest;

export interface AtlasRegistryResult {
  hostIds: string[];
  baseRevision: string;
  registryRevision: string;
}

export async function prepareStaticRegistry(
  manifest: AtlasArtifactManifest,
  current: AtlasStaticRegistry | undefined,
  outputDirectory: string
): Promise<AtlasRegistryResult> {
  assertStaticRegistry(current);
  assertArtifactManifest(manifest);
  assertSafeRegistryId(manifest.id, `${manifest.kind} ID`);

  const registry = publishArtifact(current, manifest);
  const baseRevision = registryRevision(current);
  registry.revision = registryRevision(registry);
  await writeJson(outputDirectory, "registry.json", registry);
  await writeArtifactIndex(outputDirectory, manifest, registry);

  const hostIds = manifest.channel === "production" ? affectedHostIds(manifest, registry) : [];
  for (const hostId of hostIds) {
    const catalog = createHostCatalog(hostId, registry, manifest.createdAt);
    if (!catalog) continue;
    await writeJson(outputDirectory, `hosts/${hostId}/deployments/${catalog.revision.replace(":", "-")}.json`, catalog);
    await writeJson(outputDirectory, `hosts/${hostId}/catalog.json`, catalog);
  }
  return { hostIds, baseRevision, registryRevision: registry.revision };
}

export function registryRevision(registry: AtlasStaticRegistry | undefined): string {
  const input = registry ? {
    hosts: [...registry.hosts].sort(compareArtifactIdentity).map(sortObjectKeys),
    apps: [...registry.apps].sort(compareArtifactIdentity).map(sortObjectKeys),
    selections: sortObjectKeys(registry.selections ?? {})
  } : { hosts: [], apps: [], selections: {} };
  return `sha256:${createHash("sha256").update(JSON.stringify(input)).digest("hex")}`;
}

export function createHostCatalog(
  hostId: string,
  registry: AtlasStaticRegistry,
  generatedAt = new Date().toISOString()
): AtlasHostCatalog | undefined {
  const host = selectProductionArtifact(registry.hosts, registry.selections?.hosts?.[hostId]);
  if (!host || host.id !== hostId) return undefined;
  const selectedApps = selectProductionApps(registry.apps, registry.selections?.apps);
  const apps = includeHostApps(hostId, selectedApps);
  const catalogContent = { hostId, host, apps };
  const revision = `sha256:${createHash("sha256").update(JSON.stringify(sortObjectKeys(catalogContent))).digest("hex")}`;
  return { schemaVersion: "1", hostId, revision, generatedAt, host, apps };
}

export async function prepareStaticRollback(options: {
  artifactId: string;
  version: string;
  buildId?: string;
  current: AtlasStaticRegistry;
  outputDirectory: string;
  updatedAt?: string;
}): Promise<AtlasRegistryResult & { selected: AtlasArtifactManifest }> {
  assertStaticRegistry(options.current);
  const candidates = [...options.current.hosts, ...options.current.apps].filter((manifest) =>
    manifest.id === options.artifactId && manifest.channel === "production" && manifest.version === options.version &&
    (!options.buildId || manifest.buildId === options.buildId));
  if (candidates.length === 0) throw new Error(`No production build found for Atlas artifact "${options.artifactId}" at version "${options.version}".`);
  if (candidates.length > 1) throw new Error(`Atlas artifact "${options.artifactId}" has multiple builds for version "${options.version}". Pass --build-id.`);

  const selected = candidates[0]!;
  const updatedAt = options.updatedAt ?? new Date().toISOString();
  const registry = selectArtifact(options.current, selected, updatedAt);
  const baseRevision = registryRevision(options.current);
  registry.revision = registryRevision(registry);
  await writeJson(options.outputDirectory, "registry.json", registry);
  const hostIds = affectedHostIds(selected, registry);
  for (const hostId of hostIds) {
    const catalog = createHostCatalog(hostId, registry, updatedAt);
    if (catalog) await writeJson(options.outputDirectory, `hosts/${hostId}/catalog.json`, catalog);
  }
  return { hostIds, baseRevision, registryRevision: registry.revision, selected };
}

function publishArtifact(current: AtlasStaticRegistry | undefined, manifest: AtlasArtifactManifest): AtlasStaticRegistry {
  const registry: AtlasStaticRegistry = {
    schemaVersion: "1",
    updatedAt: manifest.createdAt,
    hosts: replaceArtifact(current?.hosts ?? [], manifest.kind === "host" ? manifest : undefined),
    apps: replaceArtifact(current?.apps ?? [], manifest.kind === "app" ? manifest : undefined),
    selections: {
      hosts: { ...(current?.selections?.hosts ?? {}) },
      apps: { ...(current?.selections?.apps ?? {}) }
    }
  };
  if (manifest.channel === "production") {
    const selections = manifest.kind === "host" ? registry.selections!.hosts! : registry.selections!.apps!;
    selections[manifest.id] = selectionOf(manifest);
  }
  return registry;
}

function selectArtifact(current: AtlasStaticRegistry, selected: AtlasArtifactManifest, updatedAt: string): AtlasStaticRegistry {
  return {
    ...current,
    updatedAt,
    selections: {
      hosts: {
        ...(current.selections?.hosts ?? {}),
        ...(selected.kind === "host" ? { [selected.id]: selectionOf(selected) } : {})
      },
      apps: {
        ...(current.selections?.apps ?? {}),
        ...(selected.kind === "app" ? { [selected.id]: selectionOf(selected) } : {})
      }
    }
  };
}

function selectionOf(manifest: AtlasArtifactManifestBase): AtlasProductionSelection {
  return { version: manifest.version, buildId: manifest.buildId };
}

function replaceArtifact<T extends AtlasArtifactManifest>(manifests: T[], published: T | undefined): T[] {
  if (!published) return [...manifests];
  const key = artifactKey(published);
  return [...manifests.filter((manifest) => artifactKey(manifest) !== key), published]
    .sort((left, right) => left.id.localeCompare(right.id) || compareNewestFirst(left, right));
}

async function writeArtifactIndex(output: string, published: AtlasArtifactManifest, registry: AtlasStaticRegistry): Promise<void> {
  if (published.kind === "host") {
    const index: AtlasHostIndex = {
      schemaVersion: "1", kind: "host", id: published.id, updatedAt: published.createdAt,
      manifests: registry.hosts.filter((candidate) => candidate.id === published.id).sort(compareNewestFirst)
    };
    await writeJson(output, `hosts/${published.id}/index.json`, index);
    return;
  }
  const index: AtlasAppIndex = {
    schemaVersion: "1", kind: "app", id: published.id, updatedAt: published.createdAt,
    manifests: registry.apps.filter((candidate) => candidate.id === published.id).sort(compareNewestFirst)
  };
  await writeJson(output, `apps/${published.id}/index.json`, index);
}

function affectedHostIds(manifest: AtlasArtifactManifest, registry: AtlasStaticRegistry): string[] {
  if (manifest.kind === "host") return [manifest.id];
  const hostIds = new Set(registry.hosts.map((host) => host.id));
  for (const app of registry.apps) {
    for (const hostId of app.supportedHosts) if (hostId !== "*") hostIds.add(hostId);
    for (const placement of app.placements) hostIds.add(placement.hostId);
  }
  return [...hostIds].sort();
}

function selectProductionApps(
  manifests: AtlasManifest[],
  selections: Readonly<Record<string, AtlasProductionSelection>> | undefined
): AtlasManifest[] {
  const appIds = [...new Set(manifests.map((manifest) => manifest.id))];
  return appIds.flatMap((id) => {
    const selected = selectProductionArtifact(manifests.filter((manifest) => manifest.id === id), selections?.[id]);
    return selected ? [selected] : [];
  });
}

function selectProductionArtifact<T extends AtlasArtifactManifest>(
  manifests: T[],
  selection: AtlasProductionSelection | undefined
): T | undefined {
  const production = manifests.filter((manifest) => manifest.channel === "production");
  if (selection) return production.find((manifest) => manifest.version === selection.version && manifest.buildId === selection.buildId);
  return production.sort(compareNewestFirst)[0];
}

function includeHostApps(hostId: string, selectedApps: AtlasManifest[]): AtlasManifest[] {
  return selectedApps
    .filter((manifest) => manifest.placements.some((placement) => placement.hostId === hostId))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function assertStaticRegistry(registry: AtlasStaticRegistry | undefined): void {
  if (!registry) return;
  if (registry.schemaVersion !== "1" || !Array.isArray(registry.hosts) || !Array.isArray(registry.apps)) {
    throw new Error("The static Atlas registry is malformed or uses an unsupported schema version.");
  }
  registry.hosts.forEach(assertAtlasHostManifest);
  registry.apps.forEach(assertAtlasManifest);
  const actualRevision = registryRevision(registry);
  if (registry.revision && registry.revision !== actualRevision) {
    throw new Error(`The static Atlas registry revision is invalid. Expected "${registry.revision}", but its contents produce "${actualRevision}".`);
  }
}

function assertArtifactManifest(manifest: AtlasArtifactManifest): void {
  if (manifest.kind === "host") assertAtlasHostManifest(manifest);
  else assertAtlasManifest(manifest);
}

function artifactKey(manifest: AtlasArtifactManifestBase): string {
  return `${manifest.kind}:${manifest.id}:${manifest.channel}:${manifest.version}:${manifest.buildId}`;
}

function compareArtifactIdentity(left: AtlasArtifactManifestBase, right: AtlasArtifactManifestBase): number {
  return artifactKey(left).localeCompare(artifactKey(right));
}

function compareNewestFirst(left: AtlasArtifactManifestBase, right: AtlasArtifactManifestBase): number {
  const version = right.version.localeCompare(left.version, undefined, { numeric: true, sensitivity: "base" });
  return version || right.createdAt.localeCompare(left.createdAt) || right.buildId.localeCompare(left.buildId);
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => [key, sortObjectKeys(entry)]));
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
