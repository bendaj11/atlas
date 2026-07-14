import { readFile, mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { createAtlasBootstrapFiles } from "@atlas/bootstrap";
import { CliArguments } from "./arguments.js";
import type { AtlasBuildService } from "./build.js";
import { compileAtlasConfig } from "./config-compiler.js";
import { createHostRuntimeConfig } from "./runtime-config.js";
import type { AtlasWorkspace } from "./workspace.js";

type BootstrapBuildService = Pick<AtlasBuildService, "loadConfig">;

export interface AtlasBootstrapBuildResult {
  directory: string;
  files: string[];
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
    const template = await this.loadTemplate(project.root);
    const files = createAtlasBootstrapFiles({
      runtime,
      ...(template ? { html: template } : {}),
      ...(this.args.flag("title") ? { title: this.args.flag("title") } : {}),
      ...(this.args.flag("loading-html") ? { loadingHtml: this.args.flag("loading-html") } : {})
    });
    const directory = resolve(this.args.flag("out") ?? join(project.root, "dist", "bootstrap"));
    await mkdir(directory, { recursive: true });
    await Promise.all(files.map(async (file) => {
      await writeFile(join(directory, file.path), file.contents, "utf8");
    }));
    return { directory, files: files.map((file) => file.path) };
  }

  private async loadTemplate(projectRoot: string): Promise<string | undefined> {
    const configuredPath = this.args.flag("template");
    if (!configuredPath) return undefined;
    const templatePath = isAbsolute(configuredPath) ? configuredPath : resolve(projectRoot, configuredPath);
    return await readFile(templatePath, "utf8");
  }
}
