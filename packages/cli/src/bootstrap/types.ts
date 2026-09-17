import type {
  AtlasBootstrapFile,
  AtlasBootstrapOptions,
} from '@atlas/bootstrap';
import type { AtlasBuildService } from '../build/index.js';
import type { CliArguments } from '../shared/index.js';
import type { AtlasProject, AtlasWorkspace } from '../workspace/index.js';

export interface AtlasBootstrapBuildResult {
  directory: string;
  files: string[];
  digest: string;
}

export interface AtlasBootstrapDependencies {
  compileConfig(
    workspace: AtlasWorkspace,
    project: AtlasProject,
  ): Promise<void>;
  loadTemplate(
    projectRoot: string,
    templatePath?: string,
  ): Promise<string | undefined>;
  createFiles(options: AtlasBootstrapOptions): AtlasBootstrapFile[];
  removeDirectory(directory: string): Promise<void>;
  createDirectory(directory: string): Promise<void>;
  writeOutput(path: string, contents: string): Promise<void>;
}

export interface AtlasBootstrapServiceOptions {
  workspace: AtlasWorkspace;
  args: CliArguments;
  builds: Pick<AtlasBuildService, 'loadConfig'>;
  dependencies?: AtlasBootstrapDependencies;
}
