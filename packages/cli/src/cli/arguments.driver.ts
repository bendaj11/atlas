import { CliArguments } from './arguments.js';

export class ArgumentsDriver {
  private values: string[] = [];

  readonly given = {
    values: (values: string[]): this => {
      this.values = values;

      return this;
    },
  };

  readonly get = {
    arguments: (): CliArguments => new CliArguments(this.values),
  };
}
