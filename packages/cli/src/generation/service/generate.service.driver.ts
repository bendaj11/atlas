import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { faker } from '@faker-js/faker';
import { CliArguments } from '../../cli/arguments.js';
import { createPromptDriver } from '../../cli/interaction/interaction.testkit.js';
import { createTestWorkspace } from '../../test-utils/build.testkit.js';
import { detectWorkspace } from '../../workspace/service/workspace.js';
import { AtlasGenerateService } from './generate.service.js';

type GenerateScenario =
  | 'interactive-angular'
  | 'occupied-ports'
  | 'explicit-port'
  | 'interactive-widget'
  | 'explicit-widget'
  | 'unconfigured-widget';

export class GenerateServiceDriver {
  private readonly name = faker.word.noun().toLowerCase();
  private readonly widgetName = faker.word.noun().toLowerCase();
  private readonly catalogId = faker.string.uuid();
  private readonly ordersId = faker.string.uuid();
  private readonly explicitPort = faker.number.int({ min: 5000, max: 6000 });
  private action?: () => Promise<unknown>;
  private prompts?: ReturnType<typeof createPromptDriver>;
  private generatedConfigPath = '';
  private turboPath = '';
  private widgetFilePath = '';
  private wrongWidgetFilePath = '';

  given = {
    generation: async (scenario: GenerateScenario): Promise<void> => {
      if (scenario === 'interactive-angular') {
        await this.prepareInteractiveAngular();
      }

      if (scenario === 'occupied-ports') await this.prepareOccupiedPorts();
      if (scenario === 'explicit-port') await this.prepareExplicitPort();
      if (
        scenario === 'interactive-widget' ||
        scenario === 'explicit-widget' ||
        scenario === 'unconfigured-widget'
      ) {
        await this.prepareWidget(scenario);
      }
    },
    turboGeneration: async (type: 'app' | 'host'): Promise<void> => {
      await this.prepareTurboExistingDev(type);
    },
  };

  when = {
    generate: async (): Promise<void> => {
      if (!this.action) throw new Error('Generation setup is required.');

      await this.action();
    },
  };

  get = {
    configuredPort: (): number => this.explicitPort,
    generatedConfig: async (): Promise<string> =>
      readFile(this.generatedConfigPath, 'utf8'),
    promptState: () => ({
      choiceLabels: this.prompts?.choiceLabels[1] ?? [],
      defaults: this.prompts?.inputDefaults ?? [],
      questions: this.prompts?.questions ?? [],
    }),
    suggestedPorts: (): readonly (string | undefined)[] =>
      this.prompts?.inputDefaults ?? [],
    turboDevTask: async (): Promise<Record<string, unknown>> => {
      const turbo = JSON.parse(await readFile(this.turboPath, 'utf8'));
      return turbo.tasks.dev;
    },
    turboPublishTask: async (): Promise<Record<string, unknown>> => {
      const turbo = JSON.parse(await readFile(this.turboPath, 'utf8'));
      return turbo.tasks['atlas:publish'];
    },
    widgetState: async () => ({
      choiceLabels: this.normalizeChoices(this.prompts?.choiceLabels ?? []),
      generated: (await readFile(this.widgetFilePath, 'utf8')).includes(
        'Widget',
      ),
      questions: this.prompts?.questions ?? [],
      wrongProjectContainsWidget: await this.exists(this.wrongWidgetFilePath),
    }),
  };

  private async prepareInteractiveAngular(): Promise<void> {
    const root = await mkdtemp(join(tmpdir(), 'atlas-angular-prompts-'));
    this.prompts = createPromptDriver(['true', 'scss', '4201']);
    const workspace = createTestWorkspace({
      generationRoot: (_type, name) => join(root, name),
      root,
    });
    const service = new AtlasGenerateService(
      workspace,
      new CliArguments(['--framework=angular', '--skip-format']),
      this.prompts,
    );

    this.action = () => service.project('app', this.name, 'angular');
  }

  private async prepareOccupiedPorts(): Promise<void> {
    const root = await mkdtemp(join(tmpdir(), 'atlas-port-suggestion-'));
    const hostRoot = join(root, faker.word.noun());
    const appRoot = join(root, faker.word.noun());

    await Promise.all([mkdir(hostRoot), mkdir(appRoot)]);
    await Promise.all([
      writeFile(join(hostRoot, 'atlas.config.ts'), 'export default {};\n'),
      writeFile(
        join(hostRoot, 'vite.config.ts'),
        'export default { server: { port: 4200 } };\n',
      ),
      writeFile(join(appRoot, 'atlas.config.ts'), 'export default {};\n'),
      writeFile(
        join(appRoot, 'angular.json'),
        JSON.stringify({
          projects: {
            app: { architect: { serve: { options: { port: 4201 } } } },
          },
        }),
      ),
    ]);

    this.prompts = createPromptDriver(['4202']);
    const workspace = createTestWorkspace({
      generationRoot: (_type, name) => join(root, name),
      listProjects: async () => [
        this.project(hostRoot, 'host'),
        this.project(appRoot, 'app'),
      ],
      root,
    });
    const service = new AtlasGenerateService(
      workspace,
      new CliArguments(['--framework=react', '--skip-format']),
      this.prompts,
    );

    this.action = () => service.project('host', this.name, 'react');
  }

  private async prepareExplicitPort(): Promise<void> {
    const root = await mkdtemp(join(tmpdir(), 'atlas-explicit-port-'));
    const workspace = createTestWorkspace({
      generationRoot: (_type, name) => join(root, name),
      listProjects: async () => {
        throw new Error('Port discovery should not run for --port.');
      },
      root,
    });
    const service = new AtlasGenerateService(
      workspace,
      new CliArguments([
        '--framework=react',
        `--port=${this.explicitPort}`,
        '--skip-format',
      ]),
      createPromptDriver(['true']),
    );
    this.generatedConfigPath = join(root, this.name, 'vite.config.ts');

    this.action = () => service.project('app', this.name, 'react');
  }

  private async prepareTurboExistingDev(type: 'app' | 'host'): Promise<void> {
    const root = await mkdtemp(join(tmpdir(), 'atlas-turbo-dev-'));
    this.turboPath = join(root, 'turbo.json');
    await writeFile(
      this.turboPath,
      JSON.stringify({ tasks: { dev: { cache: false, persistent: true } } }),
    );
    const workspace = createTestWorkspace({
      generationRoot: (_type, name) => join(root, name),
      kind: 'turbo',
      root,
    });
    const service = new AtlasGenerateService(
      workspace,
      new CliArguments(['--framework=react', '--skip-format']),
      createPromptDriver(['true', '4201']),
    );

    this.action = () => service.project(type, this.name, 'react');
  }

  private async prepareWidget(
    scenario: Extract<
      GenerateScenario,
      'interactive-widget' | 'explicit-widget' | 'unconfigured-widget'
    >,
  ): Promise<void> {
    const root = await mkdtemp(join(tmpdir(), 'atlas-widget-selection-'));
    const catalogRoot = await this.createWidgetProject(root, 'catalog', {
      framework: 'angular',
      id: this.catalogId,
      name: 'Product Catalog',
      type: 'app',
    });
    const ordersRoot = await this.createWidgetProject(root, 'orders', {
      framework: 'react',
      id: this.ordersId,
      name: 'Orders Portal',
      type: 'app',
    });

    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({
        name: faker.word.noun(),
        private: true,
        workspaces: ['catalog', 'orders'],
      }),
    );

    const interactive = scenario === 'interactive-widget';
    this.prompts = createPromptDriver(
      interactive ? [this.ordersId] : [],
      interactive,
    );
    const service = new AtlasGenerateService(
      await detectWorkspace(root),
      new CliArguments(['--skip-format', '--force']),
      this.prompts,
    );
    this.widgetFilePath = join(
      ordersRoot,
      'src',
      'exported-widgets',
      this.widgetName,
      'index.tsx',
    );
    this.wrongWidgetFilePath = join(
      catalogRoot,
      'src',
      'exported-widgets',
      this.widgetName,
      'index.tsx',
    );

    this.action = () =>
      service.widget(
        this.widgetName,
        scenario === 'explicit-widget' ? this.ordersId : undefined,
      );
  }

  private async createWidgetProject(
    workspaceRoot: string,
    directory: string,
    config: {
      framework: 'angular' | 'react';
      id: string;
      name: string;
      type: 'app';
    },
  ): Promise<string> {
    const projectRoot = join(workspaceRoot, directory);

    await mkdir(projectRoot, { recursive: true });
    await writeFile(
      join(projectRoot, 'package.json'),
      JSON.stringify({ name: directory, version: '1.0.0' }),
    );
    await writeFile(
      join(projectRoot, 'atlas.config.ts'),
      `export default ${JSON.stringify(config)};\n`,
    );

    return projectRoot;
  }

  private normalizeChoices(
    choices: readonly (readonly string[])[],
  ): string[][] {
    return choices.map((group) =>
      group.map((choice) =>
        choice
          .replace(this.ordersId, '{ordersId}')
          .replace(this.catalogId, '{catalogId}'),
      ),
    );
  }

  private project(root: string, id: string) {
    return {
      id,
      outputPaths: [],
      packageName: id,
      root,
      version: faker.system.semver(),
    };
  }

  private async exists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }
}
