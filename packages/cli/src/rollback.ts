import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { AtlasStaticRegistry } from "@atlas/schema";
import { CliArguments } from "./arguments.js";
import { prepareStaticRollback, registryRevision } from "./static-registry.js";

export class AtlasRollbackService {
  constructor(private readonly args: CliArguments) {}

  async run(mfId: string, requestedVersion?: string): Promise<{ version: string; buildId: string; output: string }> {
    const version = requestedVersion ?? this.args.flag("version");
    if (!version) throw new Error("Atlas rollback requires --version.");
    const registryBaseUrl = this.registryBaseUrl();
    const current = await this.loadRegistry();
    this.assertExpectedRevision(current);
    const output = resolve(this.args.flag("publication-directory") ?? join("dist", "atlas-rollback"));
    await rm(output, { recursive: true, force: true });
    const result = await prepareStaticRollback({
      mfId,
      version,
      ...(this.args.flag("build-id") ? { buildId: this.args.flag("build-id") } : {}),
      current,
      outputDirectory: output
    });
    const planPath = resolve(this.args.flag("publication-plan") ?? `${output}.json`);
    await mkdir(dirname(planPath), { recursive: true });
    const files = ["registry.json", ...result.hostIds.map((hostId) => `hosts/${hostId}/catalog.json`)];
    await writeFile(planPath, `${JSON.stringify({
      schemaVersion: "1",
      operation: "rollback",
      registryBaseUrl,
      generatedAt: new Date().toISOString(),
      baseRevision: result.baseRevision,
      registryRevision: result.registryRevision,
      selected: { mfId, version: result.selected.version, buildId: result.selected.buildId },
      uploadOrder: ["revalidate"],
      files: files.map((path) => ({ path, cache: "revalidate" }))
    }, null, 2)}\n`, "utf8");
    return { version: result.selected.version, buildId: result.selected.buildId, output };
  }

  private async loadRegistry(): Promise<AtlasStaticRegistry> {
    const snapshot = this.args.flag("registry-snapshot");
    if (snapshot) return JSON.parse(await readFile(resolve(snapshot), "utf8")) as AtlasStaticRegistry;
    const url = `${trimSlash(this.registryBaseUrl())}/registry.json`;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`Atlas could not read the current registry snapshot: ${response.status} ${await response.text()}`);
    return response.json() as Promise<AtlasStaticRegistry>;
  }

  private assertExpectedRevision(current: AtlasStaticRegistry): void {
    const expected = this.args.flag("expected-registry-revision");
    if (!expected) return;
    const actual = registryRevision(current.manifests, current.productionSelections);
    if (expected !== actual) {
      throw new Error(`Static registry snapshot is stale. Expected revision "${expected}", but received "${actual}". Fetch a fresh registry.json and retry.`);
    }
  }

  private registryBaseUrl(): string {
    const explicit = this.args.flag("registry-base-url") ?? process.env.ATLAS_REGISTRY_BASE_URL;
    if (!explicit) throw new Error("--registry-base-url or ATLAS_REGISTRY_BASE_URL is required for rollback.");
    return explicit;
  }
}

function trimSlash(value: string): string {
  return value.replace(/\/$/, "");
}
