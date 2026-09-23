import type { AtlasNavigationState } from '@atlas/sdk';
import type { AtlasNavigation } from '@atlas/sdk/navigation';
import { createAppNavigator } from './app-navigator.js';
import type { AtlasNavigationTarget } from './app-navigator.types.js';

export class AppNavigatorDriver {
  private error: unknown;
  private navigationPath: string | undefined;
  private targets: readonly AtlasNavigationTarget[] = [];

  readonly given = {
    targets: (targets: readonly AtlasNavigationTarget[]) => {
      this.targets = targets;

      return this;
    },
  };

  readonly when = {
    navigateTo: (appId: string, state?: AtlasNavigationState) => {
      try {
        createAppNavigator(this.navigation(), this.targets)(appId, state);
      } catch (error) {
        this.error = error as { code?: string };
      }
    },
  };

  readonly get = {
    navigationPath: () => this.navigationPath,
    error: () => this.error,
  };

  private navigation(): AtlasNavigation {
    return {
      navigate: (path) => {
        this.navigationPath = path;
      },
      replace: () => undefined,
      back: () => undefined,
      createHref: (path) => path,
      subscribe: () => () => undefined,
      getCurrentLocation: () => ({ pathname: '/', search: '', hash: '' }),
    };
  }
}
