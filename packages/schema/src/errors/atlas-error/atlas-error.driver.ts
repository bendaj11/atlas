import {
  AtlasError,
  actionableMessage,
  ensureActionableError,
  errorSummary,
  suggestedActionFor,
  type AtlasErrorOptions,
} from './atlas-error.js';

export class AtlasErrorDriver {
  private value: unknown;
  private options: string | AtlasErrorOptions | undefined;
  private result!: AtlasError;
  private text = '';

  given = {
    value: (value: unknown): this => {
      this.value = value;

      return this;
    },
    options: (options: string | AtlasErrorOptions | undefined): this => {
      this.options = options;

      return this;
    },
  };

  when = {
    ensured: (): void => {
      this.result = ensureActionableError(this.value, this.options);
    },
    constructed: (summary: string, options: AtlasErrorOptions): void => {
      this.result = new AtlasError(summary, options);
    },
    messageFormatted: (
      message: string,
      actions: string | readonly string[],
    ): void => {
      this.text = actionableMessage(message, actions);
    },
    summarized: (message: string): void => {
      this.text = errorSummary(message);
    },
    actionSuggested: (message: string): void => {
      this.text = suggestedActionFor(message);
    },
  };

  get = {
    error: (): AtlasError => this.result,
    text: (): string => this.text,
  };
}
