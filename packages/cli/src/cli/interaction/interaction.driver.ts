import { faker } from '@faker-js/faker';
import { CliArguments } from '../arguments.js';
import type { AtlasInvocation } from './interaction.js';
import { resolveInvocation } from './interaction.js';
import { PromptTestDouble } from './interaction.testkit.js';

type InteractionScenario =
  | 'interactive-generation'
  | 'configured-generation'
  | 'unconfigured-widget'
  | 'configured-widget';

export class InteractionDriver {
  private readonly appId = faker.string.uuid();
  private readonly name = faker.word.noun();
  private prompts?: PromptTestDouble;
  private invocation?: AtlasInvocation;
  private arguments?: CliArguments;

  given = {
    scenario: (scenario: InteractionScenario): void => {
      if (scenario === 'interactive-generation') {
        this.prompts = new PromptTestDouble(
          ['app', this.name, 'angular'],
          true,
        );
        this.arguments = new CliArguments(['g']);
      }

      if (scenario === 'configured-generation') {
        this.prompts = new PromptTestDouble([], false);
        this.arguments = new CliArguments([
          'g',
          'host',
          this.name,
          '--framework=react',
        ]);
      }

      if (scenario === 'unconfigured-widget') {
        this.prompts = new PromptTestDouble([], true);
        this.arguments = new CliArguments(['g', 'widget', this.name]);
      }

      if (scenario === 'configured-widget') {
        this.prompts = new PromptTestDouble([], false);
        this.arguments = new CliArguments([
          'g',
          'widget',
          this.name,
          `--app-id=${this.appId}`,
        ]);
      }
    },
  };

  when = {
    resolve: async (): Promise<void> => {
      if (!this.prompts || !this.arguments) {
        throw new Error('Interaction scenario setup is required.');
      }

      this.invocation = await resolveInvocation(this.arguments, this.prompts);
    },
  };

  get = {
    appId: (): string | undefined => this.invocation?.appId,
    choiceLabels: (): readonly string[] | undefined =>
      this.prompts?.choiceLabels[0],
    invocation: (): AtlasInvocation | undefined => this.invocation,
    questions: (): readonly string[] => this.prompts?.questions ?? [],
    configuredGeneration: (): AtlasInvocation => ({
      appId: undefined,
      command: 'g',
      framework: 'react',
      name: this.name,
      subcommand: 'host',
      version: undefined,
    }),
    generation: (): AtlasInvocation => ({
      appId: undefined,
      command: 'g',
      framework: 'angular',
      name: this.name,
      subcommand: 'app',
      version: undefined,
    }),
    generationChoices: (): readonly string[] => [
      'Application',
      'Host',
      'Exported widget',
    ],
    generationQuestions: (): readonly string[] => [
      'select:What would you like to generate?',
      'input:App name',
      'select:Framework',
    ],
    widget: (): AtlasInvocation => ({
      appId: undefined,
      command: 'g',
      framework: undefined,
      name: this.name,
      subcommand: 'widget',
      version: undefined,
    }),
    widgetAppId: (): string => this.appId,
  };
}
