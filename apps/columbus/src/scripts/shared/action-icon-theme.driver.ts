import { actionIconPathsFor } from './action-icon-theme';
import type { ColorScheme } from './messages/messages';

export class ActionIconThemeDriver {
  private paths: Readonly<Record<string, string>> | undefined;

  readonly when = {
    pathsResolved: (colorScheme: ColorScheme): this => {
      this.paths = actionIconPathsFor(colorScheme);

      return this;
    },
  };

  readonly get = {
    paths: () => this.paths,
  };
}
