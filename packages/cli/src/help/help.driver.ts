import { formatHelp, resolveRequestedHelpTopic } from './help.js';

export class HelpDriver {
  private values: string[] = [];

  readonly given = {
    values: (values: string[]): this => {
      this.values = values;

      return this;
    },
  };

  readonly get = {
    topic: (): readonly string[] | undefined =>
      resolveRequestedHelpTopic(this.values),
    help: (topic: readonly string[]): string => formatHelp(topic),
  };
}
