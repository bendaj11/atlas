import { readFile } from "node:fs/promises";
import { assertAtlasHostCatalog, type AtlasHostCatalog, type AtlasManifest, type AtlasStaticRegistry } from "../../schema/dist/index.js";

export async function readCatalog(path: string): Promise<AtlasHostCatalog> {
  const value = await readJson(path);
  assertAtlasHostCatalog(value);
  return value;
}

export async function readRegistry(path: string): Promise<AtlasStaticRegistry> {
  const value = await readJson(path);
  if (!isRegistry(value)) throw new Error(`Registry fixture "${path}" has an invalid shape.`);
  return value;
}

export async function readManifestIndex(path: string): Promise<{ manifests: AtlasManifest[] }> {
  const value = await readJson(path);
  if (!isRecord(value) || !Array.isArray(value.manifests)) throw new Error(`Manifest index "${path}" has an invalid shape.`);
  return { manifests: value.manifests.filter(isManifest) };
}

export function manifestFromUnknown(value: unknown): AtlasManifest {
  if (!isManifest(value)) throw new Error("Manifest fixture has an invalid shape.");
  return value;
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

function isRegistry(value: unknown): value is AtlasStaticRegistry {
  return isRecord(value) && value.schemaVersion === "1" && Array.isArray(value.manifests) && value.manifests.every(isManifest);
}

function isManifest(value: unknown): value is AtlasManifest {
  return isRecord(value) && value.schemaVersion === "1" && typeof value.id === "string" && typeof value.version === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
