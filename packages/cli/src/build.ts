import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { access, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  createManifestFromConfig,
  type AtlasConfig,
  type AtlasExportedWidgetManifest,
  type AtlasHostManifest,
  type AtlasManifest,
  type AtlasAppConfig,
  type AtlasHostConfig,
  type AtlasStylesheet,
  type AtlasVersionChannel,
  type AtlasWidgetConfig
} from "@atlas/schema";
import ts from "typescript";
import { CliArguments } from "./arguments.js";
import {
  inferredGitBranch,
  inferredGitCommitTitle,
  inferredGitSha,
  inferredGitTag,
  inferredPullRequestNumber
} from "./ci-metadata.js";
import { compileAtlasConfig } from "./config-compiler.js";
import { publicationContentType } from "./publication-metadata.js";
import type { AtlasProject, AtlasWorkspace } from "./workspace.js";

export type AtlasBuildResult = {
  artifact: "app" | "host";
  manifest: AtlasArtifactManifest;
  project: AtlasProject;
  sourceDirectory: string;
  files: string[];
};

type AtlasArtifactManifest = AtlasManifest | AtlasHostManifest;

export class AtlasBuildService {
  constructor(private readonly workspace: AtlasWorkspace, private readonly args: CliArguments) {}

  async build(name: string): Promise<AtlasBuildResult> {
    const project = await this.workspace.findProject(name);
    const reuseBuildOutput = this.args.hasFlag("from-build-output") || this.args.hasFlag("skip-compile");
    if (!this.args.hasFlag("skip-compile")) await compileAtlasConfig(this.workspace, project);
    const config = await this.loadConfig(project.root);
    if (!reuseBuildOutput) await this.workspace.run(project, "build");
    const manifest = await this.buildArtifactManifest(project, config);
    const entryPath = this.args.flag("entry") ?? "remoteEntry.json";
    const sourceDirectory = await findArtifactRoot(this.workspace.root, project, config, entryPath);
    const files = (await listFiles(sourceDirectory)).filter((path) => this.shouldPublish(path));
    return { artifact: manifest.kind, manifest, project, sourceDirectory, files };
  }

  async buildManifest(name: string, forcedChannel?: AtlasVersionChannel, options: { skipCompile?: boolean; baseUrl?: string } = {}): Promise<AtlasManifest> {
    const project = await this.workspace.findProject(name);
    if (!options.skipCompile && !this.args.hasFlag("skip-compile")) await this.workspace.run(project, "build");
    const config = assertAppConfig(await this.loadConfig(project.root));
    const release = releaseIdentity(this.args, project);
    const channel = forcedChannel ?? release.channel;
    const version = release.version;
    const entryPath = this.args.flag("entry") ?? "remoteEntry.json";
    const artifactRoot = channel === "local"
      ? await findArtifactRootIfPresent(this.workspace.root, project, config, entryPath)
      : await findArtifactRoot(this.workspace.root, project, config, entryPath);
    const artifactDigest = artifactRoot
      ? await hashArtifactDirectory(artifactRoot, this.args.hasFlag("include-source-maps"))
      : "local";
    const buildId = this.args.flag("build-id") ?? artifactDigest.slice(0, 12);
    const baseUrl = trimSlash(options.baseUrl ?? this.registryBaseUrl(channel));
    const remoteEntryUrl = channel === "local" ? `${baseUrl}/${entryPath}` : `${baseUrl}/apps/${config.id}/${version}/${buildId}/${entryPath}`;
    const artifactBaseUrl = remoteEntryUrl.slice(0, -entryPath.length).replace(/\/$/, "");
    const exportedWidgets = await discoverExportedWidgets(project.root, config, remoteEntryUrl);
    const styles = await discoverStylesheets({ artifactRoot: artifactRoot ?? project.root, artifactBaseUrl, framework: config.framework, channel });
    const integrity = artifactRoot && channel !== "local"
      ? `sha256-${createHash("sha256").update(await readFile(join(artifactRoot, entryPath))).digest("base64")}`
      : undefined;
    const manifest = createManifestFromConfig({
      config, version, buildId, remoteEntryUrl, channel,
      gitSha: release.gitSha,
      gitBranch: release.gitBranch,
      gitCommitTitle: release.gitCommitTitle,
      prNumber: release.prNumber,
      createdAt: buildTimestamp(),
      exportedWidgets,
      styles,
      ...(integrity ? { integrity } : {})
    });
    await mkdir(join(project.root, "dist"), { recursive: true });
    await writeFile(join(project.root, "dist", "app.manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    return manifest;
  }

  async buildLocalHostManifest(projectName: string, baseUrl: string): Promise<AtlasHostManifest> {
    const project = await this.workspace.findProject(projectName);
    const config = await this.loadConfig(project.root);
    if (!isHostConfig(config)) throw new Error(`Atlas dev expected "${projectName}" to be a host.`);
    const manifest: AtlasHostManifest = {
      schemaVersion: "1",
      kind: "host",
      id: config.id,
      name: config.name ?? config.id,
      version: project.version,
      buildId: "local",
      channel: "local",
      framework: config.framework,
      remoteEntryUrl: `${trimSlash(baseUrl)}/remoteEntry.json`,
      exposes: { entry: "./host" },
      requiredLoaderApiVersion: "^1.0.0",
      createdAt: buildTimestamp()
    };
    await mkdir(join(project.root, ".atlas"), { recursive: true });
    await writeFile(join(project.root, ".atlas", "local-host.manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    return manifest;
  }

  private async buildArtifactManifest(project: AtlasProject, config: AtlasConfig): Promise<AtlasArtifactManifest> {
    if (!isHostConfig(config)) return this.buildManifest(project.id, undefined, { skipCompile: true });
    const release = releaseIdentity(this.args, project);
    const { channel, version } = release;
    const entryPath = this.args.flag("entry") ?? "remoteEntry.json";
    const artifactRoot = await findArtifactRoot(this.workspace.root, project, config, entryPath);
    const digest = await hashArtifactDirectory(artifactRoot, this.args.hasFlag("include-source-maps"));
    const buildId = this.args.flag("build-id") ?? digest.slice(0, 12);
    const remoteEntryUrl = `${trimSlash(this.registryBaseUrl(channel))}/hosts/${config.id}/${version}/${buildId}/${entryPath}`;
    const artifactBaseUrl = remoteEntryUrl.slice(0, -entryPath.length).replace(/\/$/, "");
    const styles = await discoverStylesheets({ artifactRoot, artifactBaseUrl, framework: config.framework, channel });
    const manifest: AtlasHostManifest = {
      schemaVersion: "1",
      kind: "host",
      id: config.id,
      name: config.name ?? config.id,
      version,
      buildId,
      channel,
      framework: config.framework,
      remoteEntryUrl,
      exposes: { entry: "./host" },
      requiredLoaderApiVersion: "^1.0.0",
      createdAt: buildTimestamp(),
      integrity: `sha256-${createHash("sha256").update(await readFile(join(artifactRoot, entryPath))).digest("base64")}`,
      ...(styles.length ? { styles } : {}),
      ...(release.gitSha ? { gitSha: release.gitSha } : {}),
      ...(release.gitBranch ? { gitBranch: release.gitBranch } : {}),
      ...(release.gitCommitTitle ? { gitCommitTitle: release.gitCommitTitle } : {}),
      ...(release.prNumber ? { prNumber: release.prNumber } : {})
    };
    await mkdir(join(project.root, "dist"), { recursive: true });
    await writeFile(join(project.root, "dist", "host.manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
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

  private registryBaseUrl(channel: AtlasVersionChannel = "production"): string {
    const explicit = this.args.flag("registry-base-url") ?? process.env.ATLAS_REGISTRY_URL;
    if (explicit) return explicit;
    if (channel === "local") return "http://localhost:4400";
    throw new Error("--registry-base-url or ATLAS_REGISTRY_URL is required for non-local builds.");
  }

  private shouldPublish(path: string): boolean {
    if (isAtlasBuildMetadata(path)) return false;
    return this.args.hasFlag("include-source-maps") || !path.toLowerCase().endsWith(".map");
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

async function discoverExportedWidgets(root: string, config: AtlasConfig, ownerRemoteEntryUrl: string): Promise<AtlasExportedWidgetManifest[]> {
  const directory = join(root, "src", "exported-widgets");
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) { if (isNodeError(error) && error.code === "ENOENT") return []; throw error; }
  const widgets: AtlasExportedWidgetManifest[] = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isDirectory()) continue;
    const extension = config.framework === "react" ? "tsx" : "ts";
    try { await access(join(directory, entry.name, `index.${extension}`)); }
    catch { throw new Error(`Exported widget "${entry.name}" must contain src/exported-widgets/${entry.name}/index.${extension}.`); }
    const widgetConfigPath = join(directory, entry.name, "atlas.widget.ts");
    let widgetConfig: AtlasWidgetConfig;
    try { widgetConfig = await loadWidgetConfig(widgetConfigPath); }
    catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        throw new Error(`Exported widget "${entry.name}" must contain src/exported-widgets/${entry.name}/atlas.widget.ts. Run atlas g widget ${entry.name} --app=${config.id} or add a stable UUIDv4 id and name.`);
      }
      throw error;
    }
    widgets.push({
      schemaVersion: "1", id: widgetConfig.id, name: widgetConfig.name, ownerAppId: config.id, framework: config.framework,
      remoteEntryUrl: ownerRemoteEntryUrl,
      expose: `./widgets/${entry.name}`, contractVersion: "1"
    });
  }
  return widgets;
}

async function loadWidgetConfig(path: string): Promise<AtlasWidgetConfig> {
  const source = await readFile(path, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled).toString("base64")}`;
  const loaded = await import(moduleUrl) as { default?: unknown };
  if (!isWidgetConfig(loaded.default)) {
    throw new Error(`Widget config ${path} must export { id: UUIDv4, name: string } as default.`);
  }
  return loaded.default;
}

function isWidgetConfig(value: unknown): value is AtlasWidgetConfig {
  if (typeof value !== "object" || value === null) return false;
  const config = value as Partial<AtlasWidgetConfig>;
  return typeof config.name === "string" && config.name.trim().length > 0
    && typeof config.id === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(config.id);
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
    join(project.root, "dist", basename(project.root)),
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
    hash.update(publicationContentType(relativePath));
    hash.update("\0public, max-age=31536000, immutable\0");
    hash.update(await readFile(join(root, relativePath)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function isAtlasBuildMetadata(path: string): boolean {
  const normalized = path.split("\\").join("/");
  return normalized === "app.manifest.json" ||
    normalized === "host.manifest.json" ||
    normalized === "atlas-publication.json" ||
    normalized.startsWith("atlas-publication/");
}

function isAtlasConfig(value: unknown): value is AtlasConfig { return typeof value === "object" && value !== null && "id" in value && "framework" in value; }
function isHostConfig(config: AtlasConfig): config is AtlasHostConfig {
  if (config.type) return config.type === "host";
  return "allowCustomOverrides" in config || "allowOverrides" in config
    || "resourcesTimeoutMs" in config || "resourcesRetryCount" in config;
}
function assertAppConfig(config: AtlasConfig): AtlasAppConfig {
  if (isHostConfig(config)) {
    throw new Error(`Atlas build expects an app config for "${config.id}", but received a host config.`);
  }
  return config;
}
function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error;
}

function trimSlash(value: string): string { return value.replace(/\/$/, ""); }
function optionalNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error(`Expected an integer, received "${value}".`);
  return parsed;
}

interface ReleaseIdentity {
  channel: AtlasVersionChannel;
  version: string;
  gitSha?: string;
  gitBranch?: string;
  gitCommitTitle?: string;
  prNumber?: number;
}

function releaseIdentity(args: CliArguments, project: AtlasProject): ReleaseIdentity {
  const prNumber = optionalNumber(args.flag("pr-number") ?? inferredPullRequestNumber());
  const explicitChannel = args.flag("channel") ?? process.env.ATLAS_CHANNEL;
  const channel = explicitChannel ? args.channel(explicitChannel) : prNumber ? "pr" : "production";
  const packageVersion = args.flag("version") ?? inferredTagVersion(project) ?? project.version ?? "0.0.0";
  const version = channel === "pr" && prNumber
    ? `${packageVersion.split("+")[0]!.split("-")[0]}-pr.${prNumber}`
    : packageVersion;
  const gitSha = args.flag("git-sha") ?? inferredGitSha() ?? gitOutput(project.root, ["rev-parse", "HEAD"]);
  const gitBranch = args.flag("git-branch") ?? inferredGitBranch() ?? gitOutput(project.root, ["branch", "--show-current"]);
  const gitCommitTitle = args.flag("git-commit-title") ?? inferredGitCommitTitle() ?? gitOutput(project.root, ["log", "-1", "--pretty=%s"]);
  return {
    channel,
    version,
    ...(gitSha ? { gitSha } : {}),
    ...(gitBranch ? { gitBranch } : {}),
    ...(gitCommitTitle ? { gitCommitTitle } : {}),
    ...(prNumber ? { prNumber } : {})
  };
}

function inferredTagVersion(project: AtlasProject): string | undefined {
  const tag = inferredGitTag();
  if (!tag) return undefined;
  const escapedNames = [project.packageName, project.id]
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const match = tag.match(new RegExp(`^(?:v|(?:${escapedNames.join("|")})@)?(\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?)$`));
  return match?.[1];
}

function gitOutput(root: string, args: readonly string[]): string | undefined {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || undefined;
  } catch {
    return undefined;
  }
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
