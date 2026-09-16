import { buildTimestamp } from './timestamp.js';

export class TimestampDriver {
  private environment: NodeJS.ProcessEnv = {};

  readonly given = {
    environment: (environment: NodeJS.ProcessEnv): this => {
      this.environment = environment;

      return this;
    },
  };

  readonly get = {
    timestamp: (): string => buildTimestamp(this.environment),
  };
}
