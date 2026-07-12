import type { AtlasPrompter } from "../dist/ui.js";

export class PromptDriver implements AtlasPrompter {
  readonly questions: string[] = [];

  constructor(private readonly answers: string[], readonly interactive = true) {}

  async input(message: string): Promise<string> {
    this.questions.push(`input:${message}`);
    const answer = this.answers.shift();
    if (answer === undefined) throw new Error(`No test answer configured for "${message}".`);
    return answer;
  }

  async select<T extends string>(message: string, choices: readonly { label: string; value: T }[]): Promise<T> {
    this.questions.push(`select:${message}`);
    const answer = this.answers.shift();
    const choice = choices.find(({ value }) => value === answer);
    if (!choice) throw new Error(`Test answer "${answer ?? "missing"}" is not valid for "${message}".`);
    return choice.value;
  }

  close(): void {}
}

export function createPromptDriver(answers: string[], interactive = true): PromptDriver {
  return new PromptDriver(answers, interactive);
}
