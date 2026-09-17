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
    value: (value: unknown) => {
      this.value = value;

      return this;
    },
    options: (options: string | AtlasErrorOptions | undefined) => {
      this.options = options;

      return this;
    },
  };

  when = {
    ensured: () => {
      this.result = ensureActionableError(this.value, this.options);
    },
    constructed: (summary: string, options: AtlasErrorOptions) => {
      this.result = new AtlasError(summary, options);
    },
    messageFormatted: (
      message: string,
      actions: string | readonly string[],
    ) => {
      this.text = actionableMessage(message, actions);
    },
    summarized: (message: string) => {
      this.text = errorSummary(message);
    },
    actionSuggested: (message: string) => {
      this.text = suggestedActionFor(message);
    },
  };

  get = {
    error: () => this.result,
    text: () => this.text,
  };
}
