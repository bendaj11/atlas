import { faker } from '@faker-js/faker';
import type {
  AtlasProject,
  AtlasWorkspaceKind,
} from '../../workspace/index.js';
import { TemporaryDirectory } from '../../shared/fs/fs.testkit.js';
import { readFile } from 'node:fs/promises';
import { PromptTestDouble } from '../../shared/interaction/interaction.testkit.js';
import { aProject, aWorkspace } from '../../workspace/workspace.testkit.js';
import { AtlasGenerateService } from './generate.service.js';
import {
  CliArguments,
  doesPathExist,
  readJsonFile,
} from '../../shared/index.js';

export class GenerateServiceDriver {
  private readonly directory = new TemporaryDirectory();
  private readonly projects: AtlasProject[] = [];
  private kind: AtlasWorkspaceKind = 'standalone';
  private flags: string[] = ['--skip-format'];
  private prompts = new PromptTestDouble([], false);

  readonly given = {
    workspace: async () => {
      await this.directory.create('atlas-generate-service-');

      return this;
    },
    workspaceKind: (kind: AtlasWorkspaceKind) => {
      this.kind = kind;

      return this;
    },
    workspaceFile: async (relativePath: string, value: unknown) => {
      await this.directory.writeJson(relativePath, value);

      return this;
    },
    project: async (name: string, files: Record<string, string>) => {
      for (const [file, contents] of Object.entries(files))
        await this.directory.writeFile(`${name}/${file}`, contents);
      this.projects.push(
        aProject({
          id: name,
          packageName: name,
          root: this.directory.path(name),
        }),
      );

      return this;
    },
    flags: (flags: string[]) => {
      this.flags = ['--skip-format', ...flags];

      return this;
    },
    prompts: (answers: string[], interactive: boolean) => {
      this.prompts = new PromptTestDouble(answers, interactive);

      return this;
    },
  };

  readonly when = {
    projectGenerated: (
      type: 'host' | 'app',
      name: string,
      framework: 'react' | 'angular',
    ) => this.service().project(type, name, framework),
    widgetGenerated: (name: string, appId?: string) =>
      this.service().widget(name, appId),
  };

  readonly get = {
    questions: () => this.prompts.questions,
    inputDefaults: () => this.prompts.inputDefaults,
    choiceLabels: (index: number) => this.prompts.choiceLabels[index],
    file: (relativePath: string) =>
      readFile(this.directory.path(relativePath), 'utf8'),
    fileExists: (relativePath: string) =>
      doesPathExist(this.directory.path(relativePath)),
    json: (relativePath: string) =>
      readJsonFile<Record<string, unknown>>(this.directory.path(relativePath)),
  };

  private service() {
    return new AtlasGenerateService(
      aWorkspace({
        kind: this.kind,
        packageManager: 'npm',
        root: this.directory.root,
        generationRoot: (_type, name) => this.directory.path(name),
        listProjects: async () => this.projects,
      }),
      new CliArguments(['generate', ...this.flags]),
      this.prompts,
    );
  }
}

export function anAppConfigSource(overrides: {
  id?: string;
  name?: string;
  framework?: 'react' | 'angular';
}): string {
  return `export default ${JSON.stringify({
    id: overrides.id ?? faker.string.uuid(),
    name: overrides.name ?? faker.commerce.productName(),
    framework: overrides.framework ?? 'react',
    type: 'app',
  })};\n`;
}
