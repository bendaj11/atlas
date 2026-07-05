import { createHash } from "node:crypto";
import { access, copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  createManifestFromConfig,
  type AtlasConfig,
  type AtlasExportedComponentManifest,
  type AtlasManifest,
  type AtlasStaticRegistry,
  type AtlasStylesheet,
  type AtlasVersionChannel
} from "@atlas/contracts";
import { CliArguments } from "./arguments.js";
import { prepareStaticRegistry, registryRevision } from "./static-registry.js";
import type { AtlasProject, AtlasWorkspace } from "./workspace.js";

export class AtlasBuildService {
  constructor(private readonly workspace: AtlasWorkspace, private readonly args: CliArguments) {}

  async build(name: string): Promise<AtlasManifest> {
    const project = await this.workspace.findProject(name);
    const manifest = await this.buildManifest(name);
    await this.preparePublication(project, manifest);
    return manifest;
  }

  async buildManifest(name: string, forcedChannel?: AtlasVersionChannel, options: { skipCompile?: boolean; baseUrl?: string } = {}): Promise<AtlasManifest> {
    const project = await this.workspace.findProject(name);
    if (!options.skipCompile && !this.args.hasFlag("skip-compile")) await this.workspace.run(project, "build");
    const config = await this.loadConfig(project.root);
    const channel = forcedChannel ?? this.args.channel(process.env.ATLAS_CHANNEL ?? "production");
    const version = this.args.flag("version") ?? process.env.ATLAS_VERSION ?? project.version;
    const entryPath = this.args.flag("entry") ?? "remoteEntry.json";
    const artifactRoot = channel === "local"
      ? await findArtifactRootIfPresent(this.workspace.root, project, config, entryPath)
      : await findArtifactRoot(this.workspace.root, project, config, entryPath);
    const artifactDigest = artifactRoot
      ? await hashArtifactDirectory(artifactRoot, this.args.hasFlag("include-source-maps"))
      : "local";
    const buildId = this.args.flag("build-id") ?? process.env.ATLAS_BUILD_ID ?? `${version}-${artifactDigest.slice(0, 12)}`;
    const baseUrl = trimSlash(options.baseUrl ?? this.registryBaseUrl(channel));
    const remoteEntryUrl = channel === "local" ? `${baseUrl}/${entryPath}` : `${baseUrl}/${config.id}/${version}/${buildId}/${entryPath}`;
    const artifactBaseUrl = remoteEntryUrl.slice(0, -entryPath.length).replace(/\/$/, "");
    const exportedComponents = await discoverExportedComponents(project.root, config, remoteEntryUrl);
    const styles = await discoverStylesheets({ artifactRoot: artifactRoot ?? project.root, artifactBaseUrl, framework: config.framework, channel });
    const integrity = artifactRoot && channel !== "local"
      ? `sha256-${createHash("sha256").update(await readFile(join(artifactRoot, entryPath))).digest("base64")}`
      : undefined;
    const manifest = createManifestFromConfig({
      config, version, buildId, remoteEntryUrl, channel,
      gitSha: process.env.GIT_SHA,
      prNumber: optionalNumber(process.env.PR_NUMBER),
      createdAt: buildTimestamp(),
      exportedComponents,
      styles,
      ...(integrity ? { integrity } : {})
    });
    await mkdir(join(project.root, "dist"), { recursive: true });
    await writeFile(join(project.root, "dist", "mf.manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    return manifest;
  }

  async loadConfig(root: string): Promise<AtlasConfig> {
    const candidates = [join(root, ".atlas", "atlas.config.js"), join(root, "dist", "atlas.config.js"), join(root, "atlas.config.js")];
    for (const path of candidates) {
      try {
        await access(path);
        const module = await import(`${pathToFileURL(path).href}?t=${Date.now()}`) as { default?: AtlasConfig | { default?: AtlasConfig } };
        if (isAtlasConfig(module.default)) return module.default;
        if (module.default && "default" in module.default && isAtlasConfig(module.default.default)) return module.default.default;
      } catch { /* Try the next conventional compiler output. */ }
    }
    throw new Error(`Compiled atlas.config.js was not found for ${root}. Run without --skip-compile.`);
  }

  private async preparePublication(project: AtlasProject, manifest: AtlasManifest): Promise<void> {
    const config = await this.loadConfig(project.root);
    const entryPath = this.args.flag("entry") ?? "remoteEntry.json";
    const source = await findArtifactRoot(this.workspace.root, project, config, entryPath);
    const prefix = `${manifest.id}/${manifest.version}/${manifest.buildId}`;
    const output = resolve(this.args.flag("publication-directory") ?? join(project.root, "dist", "atlas-publication"));
    await rm(output, { recursive: true, force: true });
    const files = (await listFiles(source)).filter((path) => this.shouldPublish(path));
    for (const relativePath of files) {
      const target = join(output, prefix, relativePath);
      await mkdir(join(target, ".."), { recursive: true });
      await copyFile(join(source, relativePath), target);
    }
    await writeFile(join(output, prefix, "mf.manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    const current = await this.loadCurrentRegistry();
    this.assertExpectedRegistryRevision(current);
    const registry = await prepareStaticRegistry(manifest, current, output);
    const publicationFiles = await listFiles(output);
    const publicationPlan = resolve(this.args.flag("publication-plan") ?? `${output}.json`);
    await mkdir(dirname(publicationPlan), { recursive: true });
    await writeFile(publicationPlan, `${JSON.stringify({
      schemaVersion: "1",
      registryBaseUrl: this.registryBaseUrl(manifest.channel),
      generatedAt: manifest.createdAt,
      baseRevision: registry.baseRevision,
      registryRevision: registry.registryRevision,
      uploadOrder: ["immutable", "revalidate"],
      manifest: `${prefix}/mf.manifest.json`,
      hosts: registry.hostIds,
      files: publicationFiles.map((path) => ({ path: path.split("\\").join("/"), cache: isMutableRegistryPath(path) ? "revalidate" : "immutable" }))
    }, null, 2)}\n`, "utf8");
  }

  private registryBaseUrl(channel: AtlasVersionChannel = "production"): string {
    const explicit = this.args.flag("registry-base-url") ?? process.env.ATLAS_REGISTRY_BASE_URL;
    if (explicit) return explicit;
    if (channel === "local") return "http://localhost:4400";
    throw new Error("--registry-base-url or ATLAS_REGISTRY_BASE_URL is required for non-local builds.");
  }

  private shouldPublish(path: string): boolean {
    if (isAtlasBuildMetadata(path)) return false;
    return this.args.hasFlag("include-source-maps") || !path.toLowerCase().endsWith(".map");
  }

  private async loadCurrentRegistry(): Promise<AtlasStaticRegistry | undefined> {
    const snapshot = this.args.flag("registry-snapshot");
    if (snapshot) return JSON.parse(await readFile(resolve(snapshot), "utf8")) as AtlasStaticRegistry;
    const response = await fetch(`${trimSlash(this.registryBaseUrl())}/registry.json`, { cache: "no-store" });
    if (response.status === 404) return undefined;
    if (!response.ok) throw new Error(`Atlas could not read the current registry snapshot: ${response.status} ${await response.text()}`);
    return response.json() as Promise<AtlasStaticRegistry>;
  }

  private assertExpectedRegistryRevision(current: AtlasStaticRegistry | undefined): void {
    const expected = this.args.flag("expected-registry-revision");
    if (!expected) return;
    const actual = registryRevision(current?.manifests ?? [], current?.productionSelections);
    if (expected !== actual) {
      throw new Error(`Static registry snapshot is stale. Expected revision "${expected}", but received "${actual}". Fetch a fresh registry.json and rebuild.`);
    }
  }
}

async function discoverStylesheets(options: {
  artifactRoot: string;
  artifactBaseUrl: string;
  framework: AtlasConfig["framework"];
  channel: AtlasVersionChannel;
}): Promise<AtlasStylesheet[]> {
  const { artifactRoot, artifactBaseUrl, framework, channel } = options;
  if (channel === "local") {
    return framework === "angular" ? [{ href: `${artifactBaseUrl}/styles.css` }] : [];
  }

  const stylesheets: AtlasStylesheet[] = [];
  for (const relativePath of (await listFiles(artifactRoot)).filter((path) => path.endsWith(".css"))) {
    const bytes = await readFile(join(artifactRoot, relativePath));
    stylesheets.push({
      href: `${artifactBaseUrl}/${relativePath.split("\\").join("/")}`,
      integrity: `sha256-${createHash("sha256").update(bytes).digest("base64")}`
    });
  }
  return stylesheets;
}

async function discoverExportedComponents(root: string, config: AtlasConfig, ownerRemoteEntryUrl: string): Promise<AtlasExportedComponentManifest[]> {
  const directory = join(root, "src", "exported-components");
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) { if (isNodeError(error) && error.code === "ENOENT") return []; throw error; }
  const components: AtlasExportedComponentManifest[] = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isDirectory()) continue;
    const extension = config.framework === "react" ? "tsx" : "ts";
    try { await access(join(directory, entry.name, `index.${extension}`)); }
    catch { throw new Error(`Exported component "${entry.name}" must contain src/exported-components/${entry.name}/index.${extension}.`); }
    components.push({
      schemaVersion: "1", id: entry.name, name: title(entry.name), ownerMfId: config.id, framework: config.framework,
      remoteEntryUrl: ownerRemoteEntryUrl,
      expose: `./components/${entry.name}`, contractVersion: "1"
    });
  }
  return components;
}

async function findArtifactRoot(workspaceRoot: string, project: AtlasProject, config: AtlasConfig, entryPath: string): Promise<string> {
  const artifactRoot = await findArtifactRootIfPresent(workspaceRoot, project, config, entryPath);
  if (artifactRoot) return artifactRoot;
  throw new Error(`Atlas could not find build artifacts for "${config.id}". Run its production build first.`);
}

async function findArtifactRootIfPresent(workspaceRoot: string, project: AtlasProject, config: AtlasConfig, entryPath: string): Promise<string | undefined> {
  const conventional = [
    ...project.outputPaths,
    join(workspaceRoot, "dist", "apps", project.id),
    join(workspaceRoot, "dist", "apps", config.id),
    join(project.root, "dist", config.id),
    join(project.root, "dist")
  ];
  const candidates = config.framework === "angular"
    ? conventional.flatMap((candidate) => [join(candidate, "browser"), candidate])
    : conventional;
  for (const candidate of candidates) {
    try {
      if ((await stat(candidate)).isDirectory() && (await stat(join(candidate, entryPath))).isFile()) return candidate;
    } catch { /* Continue. */ }
  }
  return undefined;
}

async function listFiles(root: string, relative = ""): Promise<string[]> {
  const entries = await readdir(join(root, relative), { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(relative, entry.name);
    if (entry.isDirectory()) return listFiles(root, path);
    if (entry.isFile()) return [path];
    throw new Error(`Atlas cannot inventory unsupported artifact entry "${path}".`);
  }));
  return files.flat().sort();
}

async function hashArtifactDirectory(root: string, includeSourceMaps: boolean): Promise<string> {
  const hash = createHash("sha256");
  for (const relativePath of (await listFiles(root)).filter((path) =>
    !isAtlasBuildMetadata(path) && (includeSourceMaps || !path.toLowerCase().endsWith(".map")))) {
    hash.update(relativePath.split("\\").join("/"));
    hash.update("\0");
    hash.update(await readFile(join(root, relativePath)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function isMutableRegistryPath(path: string): boolean {
  const normalized = path.split("\\").join("/");
  return normalized === "registry.json" || normalized.startsWith("microfrontends/") || normalized.startsWith("hosts/");
}

function isAtlasBuildMetadata(path: string): boolean {
  const normalized = path.split("\\").join("/");
  return normalized === "mf.manifest.json" ||
    normalized === "atlas-publication.json" ||
    normalized.startsWith("atlas-publication/");
}

function isAtlasConfig(value: unknown): value is AtlasConfig { return typeof value === "object" && value !== null && "id" in value && "framework" in value; }
function isNodeError(error: unknown): error is NodeJS.ErrnoException { return error instanceof Error && "code" in error; }
function trimSlash(value: string): string { return value.replace(/\/$/, ""); }
function title(value: string): string { return value.split(/[-_\s]+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }
function optionalNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error(`Expected an integer, received "${value}".`);
  return parsed;
}

function buildTimestamp(): string {
  const explicit = process.env.ATLAS_CREATED_AT;
  if (explicit) {
    const timestamp = new Date(explicit);
    if (Number.isNaN(timestamp.valueOf())) throw new Error(`ATLAS_CREATED_AT must be an ISO-8601 timestamp, received "${explicit}".`);
    return timestamp.toISOString();
  }
  const sourceDateEpoch = process.env.SOURCE_DATE_EPOCH;
  if (!sourceDateEpoch) return new Date().toISOString();
  const seconds = Number(sourceDateEpoch);
  if (!Number.isInteger(seconds) || seconds < 0) throw new Error(`SOURCE_DATE_EPOCH must be a non-negative integer, received "${sourceDateEpoch}".`);
  return new Date(seconds * 1000).toISOString();
}
