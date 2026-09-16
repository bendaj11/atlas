import { readFile } from 'node:fs/promises';
import { faker } from '@faker-js/faker';
import { CliArguments } from '../../cli/arguments.js';
import { PromptTestDouble } from '../../cli/interaction/interaction.testkit.js';
import { exists, readJsonFile } from '../../shared/fs/fs.js';
import { TemporaryDirectory } from '../../shared/fs/fs.testkit.js';
import type {
  AtlasProject,
  AtlasWorkspaceKind,
} from '../../workspace/types.js';
import { aProject, aWorkspace } from '../../workspace/workspace.testkit.js';
import { AtlasGenerateService } from './generate.service.js';

export class GenerateServiceDriver {
  private readonly directory = new TemporaryDirectory();
  private readonly projects: AtlasProject[] = [];
  private kind: AtlasWorkspaceKind = 'standalone';
  private flags: string[] = ['--skip-format'];
  private prompts = new PromptTestDouble([], false);

  readonly given = {
    workspace: async (): Promise<this> => {
      await this.directory.create('atlas-generate-service-');

      return this;
    },
    workspaceKind: (kind: AtlasWorkspaceKind): this => {
      this.kind = kind;

      return this;
    },
    workspaceFile: async (
      relativePath: string,
      value: unknown,
    ): Promise<this> => {
      await this.directory.writeJson(relativePath, value);

      return this;
    },
    project: async (
      name: string,
      files: Record<string, string>,
    ): Promise<this> => {
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
    flags: (flags: string[]): this => {
      this.flags = ['--skip-format', ...flags];

      return this;
    },
    prompts: (answers: string[], interactive: boolean): this => {
      this.prompts = new PromptTestDouble(answers, interactive);

      return this;
    },
  };

  readonly when = {
    projectGenerated: (
      type: 'host' | 'app',
      name: string,
      framework: 'react' | 'angular',
    ): Promise<string[]> => this.service().project(type, name, framework),
    widgetGenerated: (name: string, appId?: string): Promise<void> =>
      this.service().widget(name, appId),
  };

  readonly get = {
    questions: (): readonly string[] => this.prompts.questions,
    inputDefaults: (): readonly (string | undefined)[] =>
      this.prompts.inputDefaults,
    choiceLabels: (index: number): readonly string[] | undefined =>
      this.prompts.choiceLabels[index],
    file: (relativePath: string): Promise<string> =>
      readFile(this.directory.path(relativePath), 'utf8'),
    fileExists: (relativePath: string): Promise<boolean> =>
      exists(this.directory.path(relativePath)),
    json: (relativePath: string) =>
      readJsonFile<Record<string, unknown>>(this.directory.path(relativePath)),
  };

  private service(): AtlasGenerateService {
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
