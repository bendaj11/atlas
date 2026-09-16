import { failureMessage, messageFromError } from './errors';

export class ErrorsDriver {
  private message: string | undefined;

  readonly when = {
    messageExtracted: (error: unknown): void => {
      this.message = messageFromError(error);
    },
    failureDescribed: (
      error: unknown,
      operation?: string,
      suggestedAction?: string,
    ): void => {
      this.message = failureMessage(error, operation, suggestedAction);
    },
  };

  readonly get = {
    message: (): string | undefined => this.message,
  };
}
