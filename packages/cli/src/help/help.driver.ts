import { formatHelp, resolveRequestedHelpTopic } from './help.js';

export class HelpDriver {
  private values: string[] = [];

  readonly given = {
    values: (values: string[]) => {
      this.values = values;

      return this;
    },
  };

  readonly get = {
    topic: () => resolveRequestedHelpTopic(this.values),
    help: (topic: readonly string[]) => formatHelp(topic),
  };
}
