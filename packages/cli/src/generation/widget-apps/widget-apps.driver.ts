import { jest } from '@jest/globals';
import { TemporaryDirectory } from '../../shared/fs/fs.testkit.js';
import { aProject, aWorkspace } from '../../workspace/workspace.testkit.js';
import { resolveWidgetApp, type WidgetAppSelection } from './widget-apps.js';
import type { AtlasPrompter } from '../../shared/index.js';
import type { AtlasProject } from '../../workspace/index.js';

export class WidgetAppsDriver {
  private readonly directory = new TemporaryDirectory();
  private readonly projects: AtlasProject[] = [];
  private interactive = false;
  private readonly select = jest.fn<AtlasPrompter['select']>();

  readonly given = {
    workspace: async (): Promise<this> => {
      await this.directory.create('atlas-widget-apps-');

      return this;
    },
    projectConfig: async (name: string, source: string): Promise<this> => {
      await this.directory.writeFile(`${name}/atlas.config.ts`, source);
      this.projects.push(
        aProject({ id: name, root: this.directory.path(name) }),
      );

      return this;
    },
    interactive: (interactive: boolean): this => {
      this.interactive = interactive;

      return this;
    },
    selection: (appId: string): this => {
      this.select.mockResolvedValue(appId);

      return this;
    },
  };

  readonly get = {
    app: (requestedAppId?: string): Promise<WidgetAppSelection> =>
      resolveWidgetApp({
        workspace: aWorkspace({ listProjects: async () => this.projects }),
        prompts: {
          interactive: this.interactive,
          select: this.select as AtlasPrompter['select'],
        },
        requestedAppId,
      }),
    selectMock: () => this.select,
  };
}
