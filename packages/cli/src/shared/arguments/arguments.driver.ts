import { CliArguments } from './arguments.js';

export class ArgumentsDriver {
  private values: string[] = [];

  readonly given = {
    values: (values: string[]) => {
      this.values = values;

      return this;
    },
  };

  readonly get = {
    arguments: () => new CliArguments(this.values),
  };
}
