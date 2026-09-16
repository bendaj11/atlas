import { CliArguments } from '../arguments.js';
import type { AtlasInvocation } from './interaction.js';
import { resolveInvocation } from './interaction.js';
import { PromptTestDouble } from './interaction.testkit.js';

export class InteractionDriver {
  private values: string[] = [];
  private prompts = new PromptTestDouble([], false);
  private invocation!: AtlasInvocation;

  readonly given = {
    values: (values: string[]): this => {
      this.values = values;

      return this;
    },
    prompts: (answers: string[], interactive: boolean): this => {
      this.prompts = new PromptTestDouble(answers, interactive);

      return this;
    },
  };

  readonly when = {
    resolved: async (): Promise<void> => {
      this.invocation = await resolveInvocation(
        new CliArguments(this.values),
        this.prompts,
      );
    },
  };

  readonly get = {
    invocation: (): AtlasInvocation => this.invocation,
    questions: (): readonly string[] => this.prompts.questions,
    choiceLabels: (index: number): readonly string[] | undefined =>
      this.prompts.choiceLabels[index],
  };
}
