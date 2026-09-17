import type { AtlasPrompter } from '../ui/ui.js';

export class PromptTestDouble implements AtlasPrompter {
  readonly questions: string[] = [];
  readonly choiceLabels: string[][] = [];
  readonly inputDefaults: (string | undefined)[] = [];

  constructor(
    private readonly answers: string[],
    readonly interactive: boolean,
  ) {}

  async input(message: string, fallback?: string): Promise<string> {
    this.questions.push(`input:${message}`);
    this.inputDefaults.push(fallback);
    return this.nextAnswer(message);
  }

  async select<T extends string>(
    message: string,
    choices: readonly { label: string; value: T }[],
  ): Promise<T> {
    this.questions.push(`select:${message}`);
    this.choiceLabels.push(choices.map(({ label }) => label));
    const answer = this.nextAnswer(message);
    const choice = choices.find(({ value }) => value === answer);
    if (!choice)
      throw new Error(`Test answer "${answer}" is not valid for "${message}".`);
    return choice.value;
  }

  close(): void {}

  private nextAnswer(message: string): string {
    const answer = this.answers.shift();
    if (answer === undefined)
      throw new Error(`No test answer configured for "${message}".`);
    return answer;
  }
}

export function createPromptDriver(
  answers: string[],
  interactive = true,
): PromptTestDouble {
  return new PromptTestDouble(answers, interactive);
}
