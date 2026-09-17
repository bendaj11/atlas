import { jest } from '@jest/globals';
import { aWorkspace } from '../../workspace/workspace.testkit.js';
import {
  ensureWorkspaceGenerator,
  resolveDevServerPort,
  resolveInnerRouting,
  resolveStylesheetFormat,
} from './project-options.js';
import { CliArguments, type AtlasPrompter } from '../../shared/index.js';
import type { AtlasWorkspace } from '../../workspace/index.js';

export class ProjectOptionsDriver {
  private flags: string[] = [];
  private interactive = false;
  private readonly select = jest.fn<AtlasPrompter['select']>();
  private readonly input = jest.fn<AtlasPrompter['input']>();
  private readonly missingScaffoldDependency = jest
    .fn<AtlasWorkspace['missingScaffoldDependency']>()
    .mockResolvedValue(undefined);
  private readonly installScaffoldDependency =
    jest.fn<AtlasWorkspace['installScaffoldDependency']>();

  readonly given = {
    flags: (flags: string[]): this => {
      this.flags = flags;

      return this;
    },
    interactive: (interactive: boolean): this => {
      this.interactive = interactive;

      return this;
    },
    selection: (value: string): this => {
      this.select.mockResolvedValue(value);

      return this;
    },
    inputs: (values: string[]): this => {
      for (const value of values) this.input.mockResolvedValueOnce(value);

      return this;
    },
    missingScaffoldDependency: (dependency: string): this => {
      this.missingScaffoldDependency.mockResolvedValue(dependency);

      return this;
    },
  };

  readonly get = {
    innerRouting: (type: 'host' | 'app') =>
      resolveInnerRouting(this.context(), type),
    stylesheetFormat: (framework: 'react' | 'angular') =>
      resolveStylesheetFormat(this.context(), framework),
    devServerPort: (type: 'host' | 'app') =>
      resolveDevServerPort(this.context(), type),
    workspaceGeneratorEnsured: (framework: 'react' | 'angular') =>
      ensureWorkspaceGenerator(this.context(), framework),
    selectMock: () => this.select,
    installScaffoldDependencyMock: () => this.installScaffoldDependency,
  };

  private context() {
    return {
      workspace: aWorkspace({
        listProjects: async () => [],
        missingScaffoldDependency: this.missingScaffoldDependency,
        installScaffoldDependency: this.installScaffoldDependency,
      }),
      args: new CliArguments(['generate', 'app', 'x', ...this.flags]),
      prompts: {
        interactive: this.interactive,
        select: this.select as AtlasPrompter['select'],
        input: this.input,
        close: () => undefined,
      },
    };
  }
}
