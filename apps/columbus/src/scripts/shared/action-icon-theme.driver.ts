import { actionIconPathsFor } from './action-icon-theme';
import type { ColorScheme } from './messages/messages';

export class ActionIconThemeDriver {
  private paths: Readonly<Record<string, string>> | undefined;

  readonly when = {
    pathsResolved: (colorScheme: ColorScheme): void => {
      this.paths = actionIconPathsFor(colorScheme);
    },
  };

  readonly get = {
    paths: () => this.paths,
  };
}
