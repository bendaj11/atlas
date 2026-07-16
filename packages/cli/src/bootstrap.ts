import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createAtlasBootstrapFiles } from "@atlas/bootstrap";
import { CliArguments } from "./arguments.js";
import { loadBootstrapTemplate } from "./bootstrap-template.js";
import type { AtlasBuildService } from "./build.js";
import { compileAtlasConfig } from "./config-compiler.js";
import { createHostRuntimeConfig } from "./runtime-config.js";
import type { AtlasWorkspace } from "./workspace.js";

type BootstrapBuildService = Pick<AtlasBuildService, "loadConfig">;

export interface AtlasBootstrapBuildResult {
  directory: string;
  files: string[];
  digest: string;
}

export class AtlasBootstrapService {
  constructor(
    private readonly workspace: AtlasWorkspace,
    private readonly args: CliArguments,
    private readonly builds: BootstrapBuildService
  ) {}

  async build(name: string): Promise<AtlasBootstrapBuildResult> {
    const project = await this.workspace.findProject(name);
    if (!this.args.hasFlag("skip-compile")) await compileAtlasConfig(this.workspace, project);
    const config = await this.builds.loadConfig(project.root);
    const runtime = createHostRuntimeConfig(config, this.args, project.version);
    const template = await loadBootstrapTemplate(project.root, this.args.flag("template"));
    const files = createAtlasBootstrapFiles({
      runtime,
      ...(template !== undefined ? { html: template } : {}),
      ...(this.args.flag("title") ? { title: this.args.flag("title") } : {}),
      ...(this.args.flag("loading-html") ? { loadingHtml: this.args.flag("loading-html") } : {})
    });
    const directory = resolve(this.args.flag("out") ?? join(project.root, "dist", "bootstrap"));
    const digest = bootstrapDigest(files);
    const metadata = {
      schemaVersion: "1",
      digest,
      files: files.map(({ path }) => path).sort()
    };
    await rm(directory, { recursive: true, force: true });
    await mkdir(directory, { recursive: true });
    await Promise.all([...files, { path: "atlas.bootstrap.json", contents: `${JSON.stringify(metadata, null, 2)}\n` }].map(async (file) => {
      await writeFile(join(directory, file.path), file.contents, "utf8");
    }));
    return { directory, files: [...files.map((file) => file.path), "atlas.bootstrap.json"], digest };
  }
}

function bootstrapDigest(files: readonly { path: string; contents: string }[]): string {
  const hash = createHash("sha256");
  for (const file of [...files].sort((left, right) => left.path.localeCompare(right.path))) {
    hash.update(file.path);
    hash.update("\0");
    hash.update(file.contents);
    hash.update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
}
