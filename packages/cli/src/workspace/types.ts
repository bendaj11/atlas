import type { ChildProcess } from 'node:child_process';
import type { AngularStylesheetFormat } from '@atlas/generators';

export type AtlasWorkspaceKind = 'nx' | 'turbo' | 'workspace' | 'standalone';
export type AtlasPackageManager = 'yarn' | 'pnpm' | 'npm';
export type AtlasTask =
  | 'atlas:config'
  | 'atlas:bootstrap'
  | 'atlas:publish'
  | 'build'
  | 'dev'
  | 'framework:dev'
  | 'serve';
export type AtlasNxProjectType = 'angular' | 'react';
export type AtlasProjectType = 'host' | 'app';

export interface AtlasProject {
  id: string;
  root: string;
  packageName: string;
  version: string;
  outputPaths: string[];
}

export interface AtlasScaffoldOptions {
  type: AtlasProjectType;
  name: string;
  framework: AtlasNxProjectType;
  projectRoot: string;
  devServerPort: number;
  interactive: boolean;
  routing: boolean;
  stylesheetFormat?: AngularStylesheetFormat;
}

export interface AtlasWorkspace {
  kind: AtlasWorkspaceKind;
  root: string;
  packageManager: AtlasPackageManager;
  findProject(name: string): Promise<AtlasProject>;
  listProjects(): Promise<AtlasProject[]>;
  run(project: AtlasProject, task: AtlasTask, args?: string[]): Promise<void>;
  spawn(project: AtlasProject, task: AtlasTask, args?: string[]): ChildProcess;
  formatGenerated(projectRoot: string): Promise<boolean>;
  installDependencies(projectRoot: string): Promise<void>;
  missingScaffoldDependency(
    projectType: AtlasNxProjectType,
  ): Promise<string | undefined>;
  installScaffoldDependency(projectType: AtlasNxProjectType): Promise<void>;
  scaffoldProject(options: AtlasScaffoldOptions): Promise<boolean>;
  generationRoot(type: AtlasProjectType, name: string): string;
}
