import { failureMessage, messageFromError } from './errors';

export class ErrorsDriver {
  private message: string | undefined;

  readonly when = {
    messageExtracted: (error: unknown): this => {
      this.message = messageFromError(error);

      return this;
    },
    failureDescribed: (
      error: unknown,
      operation?: string,
      suggestedAction?: string,
    ): this => {
      this.message = failureMessage(error, operation, suggestedAction);

      return this;
    },
  };

  readonly get = {
    message: (): string | undefined => this.message,
  };
}
