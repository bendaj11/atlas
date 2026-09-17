import { CliArguments } from '../arguments/arguments.js';
import type { AtlasInvocation } from './interaction.js';
import { resolveInvocation } from './interaction.js';
import { PromptTestDouble } from './interaction.testkit.js';

export class InteractionDriver {
  private values: string[] = [];
  private prompts = new PromptTestDouble([], false);
  private invocation!: AtlasInvocation;

  readonly given = {
    values: (values: string[]) => {
      this.values = values;

      return this;
    },
    prompts: (answers: string[], interactive: boolean) => {
      this.prompts = new PromptTestDouble(answers, interactive);

      return this;
    },
  };

  readonly when = {
    resolved: async () => {
      this.invocation = await resolveInvocation(
        new CliArguments(this.values),
        this.prompts,
      );
    },
  };

  readonly get = {
    invocation: () => this.invocation,
    questions: () => this.prompts.questions,
    choiceLabels: (index: number) => this.prompts.choiceLabels[index],
  };
}
