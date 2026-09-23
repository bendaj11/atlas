import { createBuildTimestamp } from './timestamp.js';

export class TimestampDriver {
  private environment: NodeJS.ProcessEnv = {};

  readonly given = {
    environment: (environment: NodeJS.ProcessEnv) => {
      this.environment = environment;

      return this;
    },
  };

  readonly get = {
    timestamp: () => createBuildTimestamp(this.environment),
  };
}
